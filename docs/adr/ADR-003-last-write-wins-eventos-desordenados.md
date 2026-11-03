# ADR-003: Last-write-wins por timestamp para eventos atrasados y duplicados en el camino en vivo

**Estado:** Aceptado

---

## Contexto y fuerzas

El camino en vivo guarda el último estado de cada bus y avisa al operador cuando hay una anomalía (bus detenido o fuera de ruta). La red celular entrega los reportes GPS fuera de orden y a veces repetidos. El [ADR-001](ADR-001-asincronismo-gps.md) ya fijó la regla de negocio: gana el evento más reciente por `timestamp`, no el último que llega. Este ADR registra la táctica que la implementa en `procesar-posicion.js` y lo que cuesta.

Las fuerzas que pesan, tomadas del escenario de calidad:

- **Un estado viejo que pisa a uno nuevo no lanza excepción.** El mapa mostraría el bus en una posición anterior sin ningún error visible.
- **Un duplicado repite la alerta.** Si el mismo evento se procesa dos veces, el operador recibe dos veces la misma alerta del mismo bus y el mismo instante.
- **La medida del escenario es exigente:** en 3 minutos de operación (350 buses, un reporte cada 4 s, 15.750 eventos), con 20 % de eventos atrasados hasta 180 s y 10 % duplicados, el 100 % de los buses debe quedar con su posición más reciente y no debe haber ninguna alerta duplicada.
- **El camino en vivo debe seguir siendo rápido.** La táctica agrega una lectura del estado anterior por cada evento, y ese costo hay que medirlo.

## Decisión

Se aplica **last-write-wins por timestamp** al inicio del caso de uso `procesar`:

1. Se lee el estado anterior del bus (`repo.obtener`).
2. Si existe y el `timestamp` del evento es **menor** que el guardado, se descarta como `'atrasado'`.
3. Si es **igual**, se descarta como `'duplicado'`: es el mismo evento reentregado y no debe volver a guardar ni a disparar la alerta.
4. Si es **mayor**, se guarda y, si corresponde, se notifica la anomalía.

La comparación se hace con `Date.parse`, es decir, entre instantes y no entre textos. Separar `<` de `===` permite devolver el motivo exacto del descarte.

## Alternativas descartadas

1. **Sin táctica: guardar lo que llegue.** Es lo más rápido y simple, pero el escenario no se cumple (ver resultados abajo). Un evento atrasado reemplaza al nuevo y un duplicado repite la alerta.
2. **Deduplicar solo por `(bus_id, timestamp)`.** Quita los duplicados, pero no evita que un evento atrasado pise un estado más nuevo.
3. **Ordenar por llegada y bloquear hasta que lleguen los atrasados.** No tolera la red celular: un solo evento tardío frenaría al resto.

## Costo medido

Medido en el computador de **[JUAN DAVID QUINTERO MELO]** (**[AMD RYZEN 3600 6-CORE ]**, **[16 GB RAM]**, Node [v24.16.0], **[WINDOWS 11]**), con `npm run escenario` (modo `con-falla`), 5 corridas por versión. Tiempo por evento, en µs:

| Corrida | Con táctica: promedio | Con táctica: p99 | Sin táctica: promedio | Sin táctica: p99 |
| ------- | --------------------- | ---------------- | --------------------- | ---------------- |
| 1       | [  1.31 µs ]          | [2.50 µs ]       | [ 0.61 µs ]           | [ 1.10 µs ]      |
| 2       | [  1.26 µs ]          | [3.90 µs ]       | [ 0.70 µs ]           | [ 1.90 µs ]      |
| 3       | [  1.35 µs ]          | [2.70 µs ]       | [ 0.71 µs ]           | [ 1.60 µs ]      |
| 4       | [  1.29 µs ]          | [2.80 µs ]       | [ 0.70 µs ]           | [ 1.60 µs ]      |
| 5       | [  1.30 µs ]          | [2.60 µs ]       | [ 0.72 µs ]           | [ 2.00 µs ]      |
| **Promedio de las 5** |
          |**[ 1.30 µs ]**        | **[ 2.90 µs ]**  | **[ 0.69 µs ]**       | **[ 1.64 µs ]**  |

Diferencia: la táctica suma **[ 0.61 µs ] ** al promedio y **[ 1.26 µs ]** al p99 por evento. Con el repositorio en memoria el costo es una lectura de un `Map`; con Redis (servicio `tiempo-real`) la lectura será una ida a la red, y ese costo no está medido aquí.

Resultado del escenario según la versión (modo `con-falla`):

| Versión       | Buses con su posición más reciente | Alertas duplicadas | Resultado |
| ------------- | ---------------------------------- | ------------------ | --------- |
| Con táctica   | 350/350 (100 %)                    | 0                  | Cumplido  |
| Sin táctica   | [35/350 (10 %)]                    | [501]              | No cumplido |

## Limitación conocida: reloj adelantado

Last-write-wins confía en el reloj de la fuente. Si un bus reporta una vez con el reloj en el futuro, ese `timestamp` queda guardado como "el más reciente" y todos sus eventos legítimos posteriores se descartan como `'atrasado'`. El escenario `npm run escenario:reloj-adelantado` lo muestra: 349/350 buses con su posición más reciente, y el escenario no se cumple. Esta limitación se acepta por ahora y se mitigaría validando el `timestamp` contra la hora del gateway al ingresar el evento.

## Consecuencias

### Beneficios

- El mapa en vivo nunca retrocede a una posición vieja por un evento atrasado.
- Un evento reentregado no vuelve a disparar la alerta al operador.
- El costo por evento es de microsegundos con el repositorio en memoria.

### Trade-offs aceptados

- Cada evento exige una lectura del estado anterior antes de guardar.
- La corrección depende de que el reloj de la fuente GPS sea confiable.
- El evento descartado no llega a la vista en vivo; el histórico debe seguir guardándolo (ver [ADR-001](ADR-001-asincronismo-gps.md)).
