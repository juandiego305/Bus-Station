# Flujo: Posición del bus (Grupo 6 — Transporte)

## Paso 1. El flujo

1. El **dispositivo GPS del bus** envía su posición, velocidad y estado (Gateway de ingesta).
2. El **servicio de tiempo real** actualiza el último estado conocido del bus y lo publica hacia el mapa en vivo.
3. El **servicio de estimación** recalcula el tiempo de llegada por parada afectada por esa posición.
4. El **servicio de alertas** evalúa si hay una anomalía (bus detenido, fuera de ruta o sin reportar) y notifica al operador de flota.
5. El **servicio histórico** persiste el evento crudo para los reportes del ente gestor.

Los 5 pasos parten de un mismo evento de entrada (`PosicionReportada`) y se resuelven como consumidores independientes de ese evento, tal como se definió en el ADR-000 (arquitectura orientada a eventos con caminos separados para tiempo real e histórico).

## Paso 2. Decisión paso por paso

| Paso | Quién | Síncrono o evento | Si falla | Si se repite |
|---|---|---|---|---|
| Recibir posición GPS | Gateway de ingesta | **Evento**. El bus solo necesita un ACK de recepción; no espera a que el mapa, la estimación o las alertas terminen de procesar el dato. | El evento ya quedó escrito en el log antes de responder el ACK; si el log no está disponible, el gateway responde error y el GPS reintenta en su siguiente ciclo (4s después) | Idempotente por `(bus_id, timestamp)`: dos envíos del mismo instante se tratan como un solo evento |
| Actualizar mapa en vivo | Servicio de tiempo real (consumidor) | **Evento**. Es una proyección de lectura; no hay un usuario esperando esta actualización en ese instante exacto. | Reintenta el consumo; mientras tanto el mapa sigue mostrando el último estado válido conocido (no bloquea ni muestra vacío) | Idempotente: sobrescribe el estado del bus por *last-write-wins* según el timestamp del evento, sin importar cuántas veces se procese |
| Recalcular tiempos de llegada | Servicio de estimación (consumidor) | **Evento**. El cálculo se dispara por cada posición nueva, no por cada consulta de usuario (la consulta del usuario sí es síncrona, pero es otro flujo, no este) | Reintenta el consumo; mientras tanto se sigue sirviendo la última estimación calculada (dato desactualizado, no ausente) | Idempotente: recalcular con el mismo insumo produce el mismo resultado (función pura del estado actual) |
| Detectar anomalía y alertar | Servicio de alertas (consumidor) | **Evento**. El operador de flota no necesita que esta detección ocurra en el mismo ciclo HTTP de nada; es una notificación que llega después | Reintenta el consumo; si sigue fallando, escala por un canal secundario (ej. correo) para no perder la alerta | Idempotente por `(bus_id, tipo_alerta, ventana_de_tiempo)`, para no mandar la misma alerta duplicada al operador |
| Persistir en histórico | Servicio histórico (consumidor) | **Evento**. El ente gestor consulta reportes después, nunca en el mismo instante en que ocurre la posición | El evento permanece en el log hasta que el consumidor se recupere; no hay pérdida de datos porque el log no descarta | Idempotente por `id_evento = (bus_id, timestamp)`, con upsert o clave única para evitar duplicados en los reportes de puntualidad/frecuencia |

### Por qué todo el flujo queda por evento

Los cinco pasos son distintos consumidores de un mismo evento de entrada, no una cadena de llamadas donde cada paso depende del resultado del anterior. Esto es consistente con la tensión principal del caso (Escenario 1: ingestión sostenida a 90 eventos/s) y con la decisión ya tomada en el ADR-000: aislar la escritura (el GPS reportando) de los distintos consumidores de lectura (mapa, estimación, alertas, histórico), para que un consumidor lento o caído no atrase ni bloquee a los demás ni al GPS.

La única operación síncrona del caso —la consulta del usuario en la app preguntando "¿cuánto falta?"— **no forma parte de este flujo**: es un flujo de lectura aparte que consulta el último estado ya calculado, sin tocar la ingesta.

Ningún paso de este flujo tiene una compensación tipo "deshacer": no hay dinero cobrado ni cupo reservado que revertir. Lo que cada consumidor debe garantizar es que reintentar (por el bus/log de eventos) no duplique efectos hacia afuera, de ahí la columna de idempotencia en cada fila.