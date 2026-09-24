# ADR-001: Procesamiento asíncrono de posiciones GPS y manejo de eventos desordenados

**Estado:** Aceptado

---

## Contexto

El sistema recibe posiciones del GPS de cada bus cada 4 segundos, con una latencia máxima de entrega y varios consumidores distintos del mismo evento. La red móvil introduce desorden: un bus puede reportar una posición nueva, luego otra más antigua, y el sistema no puede asumir que los eventos llegan en orden ni que siempre llegan a tiempo.

Además, los componentes del flujo tienen necesidades diferentes:

- El mapa en vivo necesita la última posición conocida y una respuesta rápida.
- La estimación de llegadas necesita un estado actual que sea consistente con la realidad operativa.
- Las alertas requieren detectar anomalías sin duplicar notificaciones ni depender de una respuesta inmediata del operador.
- El histórico debe conservar cada evento para análisis posterior, incluso si llega tarde.

En este contexto, el sistema no puede depender de llamadas síncronas entre componentes porque implicaría acoplar la ingestión con los consumidores y crear cuellos de botella. Se requiere un patrón que permita tolerar rechazos puntuales, reintentos y eventos tardíos sin perder la frescura del dato ni la integridad del histórico.

## Decisión

Se adopta un modelo de procesamiento asíncrono basado en eventos con la siguiente regla de negocio:

1. El gateway recibe la posición GPS y la publica en Kafka como un evento `PosicionReportada`.
2. El ACK del gateway confirma solo que el evento fue aceptado por Kafka, no que todos los consumidores ya terminaron de procesarlo.
3. Los consumidores leen el evento de manera independiente y aplican su propia semántica de idempotencia y consistencia.
4. Para los eventos fuera de orden o retrasados, la comparación se realiza con el `timestamp` del evento y no con el orden de llegada.
5. Un evento se considera válido solo si su `timestamp` es más reciente que el último valor aceptado para ese bus; si es anterior o igual, se descarta como stale update.
6. Cuando el mismo bus reporta varias posiciones en el mismo instante o con una diferencia mínima, se usa la clave compuesta `(bus_id, timestamp)` para deduplicar y evitar re-procesamiento.

En la práctica, la semántica de tiempo real es: "mantener siempre el último estado observado para ese bus"; la semántica de histórico es: "guardar cada evento recibido, sin descartar el dato crudo, aunque llegue desordenado".

## Política de manejo de eventos desordenados

La regla central es:

- Cada evento llega con un `timestamp` de la fuente GPS.
- El estado actual por bus se actualiza solo si el evento es más reciente que el valor ya conocido.
- Si el evento llega tarde, se ignora para la vista en vivo porque ya existe un valor más nuevo.
- Si el evento llega duplicado, se identifica por `(bus_id, timestamp)` y se descarta.
- Si el consumidor histórico recibe un evento fuera de orden, no lo descarta del log; lo persiste como hecho histórico y lo procesa con idempotencia para evitar duplicados en reportes.

Esto permite reconciliar dos requisitos aparentemente opuestos:

- La capa en vivo exige máxima frescura y no puede entrar en conflicto con latencias de red o eventos antiguos.
- La capa histórica exige no perder eventos ni información, aún cuando el orden de llegada no refleje el orden real de la fuente.

## Alternativas consideradas

### 1. Procesamiento síncrono directo sobre la base de datos

Se podría hacer que cada GPS escriba directamente sobre la base de datos y que los demás servicios lean desde ahí. Esta opción es simple de implementar al principio, pero mezcla lectura y escritura de forma rígida. Un pico de usuarios o un consumo lento de alertas o reportes puede bloquear el flujo de ingesta, y además no resuelve la diferencia entre los contratos en vivo e histórico.

Se descarta porque rompe la separación de preocupaciones y hace que el sistema sea más frágil ante picos de carga o eventos desordenados.

### 2. Publicación por evento sin control de orden ni deduplicación

Se podría publicar cada posición y aceptar cualquier orden de llegada. Esto simplifica el diseño inicial, pero provoca que un estado viejo reemplace un valor más reciente, y que la misma posición se procese dos o más veces.

Se descarta porque la vista en vivo se vuelve inconsistente y los reportes pueden duplicarse o mostrarse con huecos de información.

### 3. Ordenamiento fuerte por cola, sin tolerancia a eventos atrasados

Otra alternativa es ordenar estrictamente por llegada y bloquear la operación si llega un evento tardío. Esto ayuda a la consistencia local, pero no refleja la realidad de una red celular con retrasos. En la práctica, el sistema perdería capacidad de reaccionar a señales que ya son válidas y que llegaron tarde, y se volvería muy sensible a fallas de conectividad.

Se descarta porque no tolera la naturaleza distribuida del problema.

## Consecuencias

### Beneficios

- La ingesta queda desacoplada del resto del sistema: la publicación de un evento no depende de que el mapa, la estimación o el histórico ya lo hayan consumido.
- Los consumidores pueden escalar por separado según su carga y su latencia tolerable.
- El flujo es tolerante a fallas: un consumidor caído no bloquea al resto y puede reintentar cuando vuelva.
- El manejo del desorden queda explícito y repetible en todas las capas del sistema.
- El histórico conserva la fuente completa de verdad para auditoría y análisis posterior.

### Trade-offs aceptados

- Hay que operar un bus de eventos y definir políticas claras de idempotencia y reintento.
- El dato en vivo es eventualmente consistente, no necesariamente instantáneo.
- El sistema debe tener métricas para detectar eventos atrasados, duplicados o caídas temporales.
- El equipo debe considerar una ventana de frescura operacional para garantizar que la información del mapa y de la estimación siga siendo útil aunque un evento llegue tarde.

## Reglas de implementación

Se recomienda aplicar estas reglas en todos los consumidores que usen posiciones:

- Guardar el último `timestamp` aceptado por bus.
- Ignorar eventos con `timestamp` <= `ultimo_timestamp` para la proyección de tiempo real.
- Deduplicar por `(bus_id, timestamp)` antes de escribir o emitir alertas.
- Mantener el evento original en el historial aunque haya sido descartado para la proyección en vivo.
- Hacer reintentos idempotentes en los consumidores para evitar efectos laterales duplicados.

## Resultado

La decisión tomada permite que el sistema soporte una ingesta sostenida, tolere desorden de red, mantenga un modelo de tiempo real útil y conserve una trazabilidad histórica completa sin acoplar a los consumidores entre sí.

Esto es consistente con la arquitectura orientada a eventos descrita en [ADR-000: Arquitectura orientada a eventos para la ingesta de GPS](ADR-000-sistema.md) y con el flujo de transporte documentado en [flujo-transporte.md](../flujo-transporte.md).
