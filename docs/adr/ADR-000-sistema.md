# ADR-000: Arquitectura orientada a eventos para la ingesta de GPS, con caminos separados para tiempo real e histórico

**Estado:** Propuesto

---

## Contexto

El sistema debe recibir la posición de 350 buses cada 4 segundos, es decir, un flujo sostenido de
~90 eventos/segundo durante 16 horas diarias, no un pico ocasional. Sobre ese mismo flujo conviven
consumidores muy distintos:

- La **app del usuario** y las **40 pantallas de estación**, que necesitan la posición más reciente de
  cada bus con baja latencia (RF-02, RF-03, RF-04).
- El **operador de flota**, que necesita detectar desvíos, buses detenidos o sin reportar (RF-05).
- El **ente gestor**, que necesita el histórico completo y sin huecos para calcular puntualidad y
  frecuencia por ruta y franja horaria (RF-06, RF-07).
- **Terceros externos**, que consumirán una interfaz pública sobre los datos en vivo (RF-08) y que no
  pueden competir por los mismos recursos que el sistema interno.

Estos consumidores tienen **contratos distintos sobre el mismo dato**: el camino en vivo tolera perder
un evento suelto pero no atrasarse, mientras que el camino histórico tolera llegar tarde pero no puede
tener huecos grandes. Además, un mismo dato (la posición de un bus) es leído por miles de clientes, así
que multiplicar lectores no puede multiplicar el costo de consultar la base de datos (fan-out). Finalmente,
los GPS reportan por red celular, con zonas de sombra y eventos que llegan desordenados o atrasados
hasta 3 minutos.

En consecuencia, el sistema no puede resolverse como una aplicación transaccional típica (escribir y
leer contra la misma base de datos): la escritura sostenida, la lectura masiva y la persistencia histórica
tienen presiones distintas y, si comparten el mismo camino, cualquier pico de lectores atrasaría la
ingesta y degradaría la app "para siempre", no solo por un instante.

Esta decisión define el esqueleto por donde entra y se reparte todo el flujo GPS, y de ella dependen
directamente las tres demandas de calidad conocidas del caso (ingestión sostenida, fan-out barato, dos
velocidades de la verdad).

## Decisión

Se adopta una **arquitectura orientada a eventos**: cada posición GPS se publica en un flujo (log)
central de eventos, del cual se derivan de forma independiente un **camino de tiempo real** —que
mantiene el último estado conocido de cada bus y lo distribuye por publicación/suscripción hacia el
mapa en vivo, las pantallas de estación y las alertas del operador— y un **camino histórico** —que
persiste cada evento, sin descartarlo, en un almacenamiento orientado a analítica para los reportes del
ente gestor—, dejando la interfaz pública para terceros como un consumidor adicional, aislado y con
límites de consumo propios, que nunca lee directamente del núcleo interno.

## Alternativas consideradas

1. **Base de datos relacional única, con lectura directa por parte de todos los clientes.**
   Es la opción más simple de implementar y la que el equipo domina mejor de entrada, pero mezcla en
   una sola pieza la escritura sostenida (90 eventos/s) con miles de lecturas concurrentes: cualquier
   pico de la app o de las pantallas compite por el mismo recurso que la ingesta, justo lo que el caso
   pide evitar. Se descarta porque no aísla el flujo de escritura de las consultas.

2. **Réplicas de lectura sobre la misma base transaccional (primaria + réplicas).**
   Alivia parte de la presión de lectura sin rediseñar el flujo de escritura, y es un paso intermedio
   razonable si el presupuesto no permitiera un bus de eventos. Sin embargo, cada réplica sigue siendo
   una copia completa de la base de datos, así que el costo de fan-out crece casi linealmente con el
   número de lectores (miles de usuarios), y no resuelve la diferencia de contrato entre tiempo real e
   histórico: ambos seguirían siendo la misma tabla con la misma semántica. Se descarta porque no ataca
   la causa del problema, solo amortigua el síntoma.

3. **Difusión en memoria sin log persistente (pub/sub efímero tipo WebSocket broadcast).**
   Resuelve muy bien el fan-out para el mapa en vivo y sería más barato de operar que un log de eventos.
   El problema es que, sin un buffer persistente, un consumidor lento o caído (por ejemplo una pantalla
   de estación que perdió conexión, tal como contemplan las restricciones) pierde eventos para siempre,
   y no queda ningún rastro para reconstruir el histórico ni para corregir eventos que llegan
   desordenados. Se descarta porque no da una fuente confiable para el camino histórico ni tolera el
   desorden de red celular mencionado en las restricciones.

## Consecuencias

**Mejora:**
- La ingesta queda aislada de los lectores: un pico de usuarios en la app no puede atrasar la escritura
  de posiciones, que es la demanda de calidad más crítica del caso.
- El fan-out deja de ser "una consulta por usuario": todos los consumidores en vivo leen del mismo
  último estado publicado, no de la base de datos, lo que acota el costo aunque crezcan los usuarios.
- El camino histórico puede reconstruirse o reprocesarse a partir del log si se detecta un error de
  cálculo, y puede tolerar caídas temporales sin perder datos, porque el evento queda guardado y se
  consume cuando el consumidor se recupera.
- Los dos consumidores (tiempo real e histórico) pueden evolucionar y escalarse por separado, lo cual
  facilita absorber cambios futuros (por ejemplo, un componente de IA que consuma el mismo flujo) sin
  tocar el resto del sistema.
- La interfaz pública para terceros se conecta como un consumidor más del flujo, no contra el núcleo, así
  que un abuso de esa interfaz no puede tumbar el sistema interno (restricción explícita del caso).

**Empeora / trade-off que se acepta:**
- Se introduce una pieza operativa nueva (el bus/log de eventos) que el equipo debe aprender a operar,
  monitorear y dimensionar, con su propio costo dentro del presupuesto topado por contrato.
- El camino de tiempo real pasa a ser eventualmente consistente: lo que ve el usuario es "el último
  estado publicado", no una lectura directa y sincrónica del bus, lo que exige definir y comunicar una
  ventana de frescura aceptable (ligado a RF-03: actualización cada 15 segundos).
- Hay que decidir explícitamente cómo se tratan los eventos atrasados o desordenados (corregir, marcar
  o descartar), decisión que esta ADR no cierra y que debe documentarse en un ADR posterior.
- Hay más piezas para depurar ante un incidente (productor, log, y al menos dos consumidores) en lugar
  de una sola base de datos, lo que aumenta la complejidad operativa a cambio del aislamiento ganado.