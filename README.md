# Sistema de Transporte Público en Vivo

Arquitectura de Software · UFPS · 2026-II · Grupo 6 (Transporte)

Implementación de la arquitectura orientada a eventos definida en el
[ADR-000](docs/adr/ADR-000-sistema.md) y el flujo descrito en
[`docs/flujo-transporte.md`](docs/flujo-transporte.md). Un único evento de entrada
(`PosicionReportada`) se publica en Kafka; todo lo demás son consumidores
independientes de ese evento, cada uno con su propio contrato de consistencia.

**Video de sustentación (segundo previo):** [PEGAR AQUÍ EL ENLACE DE YOUTUBE (oculto)]

## Escenario de calidad elegido

**Consistencia del camino en vivo frente a eventos atrasados y duplicados.**

> En una ventana de **3 minutos** de operación (350 buses, un reporte cada 4 s =
> **15.750 eventos**), con el **20 %** de los eventos atrasados hasta 180 s y el
> **10 %** duplicados, el **100 %** de los buses queda con su posición más reciente
> y el operador recibe **0 alertas duplicadas**.

**Origen de los números.** 350 buses y un reporte cada 4 s salen del caso (ADR-000).
La ventana de 3 minutos es el atraso máximo de la red celular que da el caso, así que
cubre el peor atraso posible; 180 s / 4 s = 45 reportes por bus × 350 = 15.750 eventos.
El 20 % de atrasados y el 10 % de duplicados son **supuestos del grupo**, porque el caso
no da esos porcentajes (declarados en `src/adaptadores/gps-simulado.js`).

**Por qué este y no los otros dos escenarios de [`docs/vision.md`](docs/vision.md):**

- *Ingestión sostenida de 90 eventos/s:* su medida ("cero degradación temporal
  sostenida") no tiene un número ni una ventana verificable, reproducirla exige
  16 horas de carga contra Kafka real, y su táctica (separar la ingesta con un log de
  eventos) ya es la arquitectura del ADR-000: no queda una táctica que aplicar y medir.
- *Fan-out barato:* su medida depende del costo de lectura en la nube, que no se puede
  medir en un computador local.
- *Consistencia (elegido):* la falla es **silenciosa**: un evento viejo pisa a uno nuevo
  y el mapa muestra al bus en una posición anterior sin lanzar ningún error, y un
  duplicado hace que el operador reciba la misma alerta dos veces. Sale de una
  restricción explícita del caso (red celular con eventos desordenados hasta 3 min), el
  ADR-000 dejó la decisión abierta, y la falla se reproduce a voluntad con un simulador
  con semilla fija.

**Camino en la vista de contenedores** (flechas rojas en
[`docs/img/Contenedores.png`](docs/img/Contenedores.png)):
GPS → Gateway de ingesta → Kafka → Servicio de tiempo real → Redis, y
Kafka → Servicio de alertas → Operador de flota. La táctica está en
`src/aplicacion/procesar-posicion.js` y su costo en el [ADR-003](docs/adr/ADR-003-last-write-wins-eventos-desordenados.md).

### Cómo ejecutar la prueba del escenario

Solo necesita Node 18 o superior; no requiere Docker ni `npm install`.

```bash
npm run escenario              # CON falla de red (atrasos y duplicados): debe cumplirse
npm run escenario:sin-falla    # SIN falla: eventos en orden y una sola vez
```

Para ver la prueba **fallando antes de la táctica** (la prueba entró en el commit
`5a521e2` y la táctica en `2384563`):

```bash
git checkout 5a521e2
npm run escenario      # 35/350 buses (10 %) y 501 alertas duplicadas: NO CUMPLIDO
git checkout main
```

Otras pruebas:

```bash
npm run escenario:reloj-adelantado   # limitación conocida de la táctica (no se cumple, ver ADR-003)
npm run guardrails                   # ADR-002: guardrails y timeout del modelo simulado
```

### Quién hizo qué

| Integrante | GitHub | Aporte | Parte del video |
|---|---|---|---|
| Juan Diego Contreras Garcia | `juandiego305` | Estructura inicial, flujo de transporte, imagen de la vista de contenedores | 1. El escenario |
| Javier Guerrero | `Javier Guerrero` | ADR-002, proveedor del modelo en `contenedores.dsl`, prueba del escenario que falla | [ ] |
| Luis Soto | `lesg1151860` | Adaptador simulado del modelo, guardrails y su prueba | [ ] |
| Yefferson Delgado | `YeffersonDelgado` | Táctica last-write-wins en `procesar-posicion.js` | [ ] |
| Juan David Quientero | `Juanda-quitero27` | ADR-003 con el costo medido | [ ] |
| Yarley Gillen | `YGGR29` | [ ] | [ ] |

## Dónde está cada decisión

| Documento | Contenido |
|---|---|
| [`docs/vision.md`](docs/vision.md) | Actores, funciones esenciales, diagrama de contexto y escenarios de calidad |
| [`docs/adr/ADR-000-sistema.md`](docs/adr/ADR-000-sistema.md) | El **porqué** de la arquitectura orientada a eventos |
| [`docs/flujo-transporte.md`](docs/flujo-transporte.md) | El **flujo paso a paso** con síncrono/evento/idempotencia |
| [`docs/adr/ADR-001-asincronismo-gps.md`](docs/adr/ADR-001-asincronismo-gps.md) | Procesamiento asíncrono y regla de eventos desordenados |
| [`docs/adr/ADR-002-modelo-lenguaje-consulta-llegadas.md`](docs/adr/ADR-002-modelo-lenguaje-consulta-llegadas.md) | Modelo de lenguaje con tool-calling + guardrails y diagrama de la falla |
| [`docs/adr/ADR-003-last-write-wins-eventos-desordenados.md`](docs/adr/ADR-003-last-write-wins-eventos-desordenados.md) | Táctica last-write-wins y su costo medido |
| [`docs/contenedores.dsl`](docs/contenedores.dsl) y [`docs/img/Contenedores.png`](docs/img/Contenedores.png) | Vista de contenedores C4, con el proveedor del modelo y el camino del escenario |

## Servicios

| Servicio | Rol en el flujo | Lee de | Endpoints | Tecnología | Puerto |
|---|---|---|---|---|---:|
| `gateway-ingesta` | Paso 1: recibe el POST del GPS y publica el evento | — | `POST /posiciones` | Express + KafkaJS | 3001 |
| `tiempo-real` | Paso 2: mantiene el último estado por bus (last-write-wins) | Kafka → Redis | `GET /buses/ruta/:rutaId`, `GET /buses/:busId` | Express + KafkaJS + Redis | 3002 |
| `estimador-llegadas` | Paso 3: recalcula ETA por parada | Kafka → Redis | `GET /llegadas/:rutaId/:paradaId` | Express + KafkaJS + Redis | 3003 |
| `alertas` | Paso 4: detecta buses detenidos, fuera de ruta o sin reportar | Kafka + watchdog → Redis | `GET /alertas/activas` | Express + KafkaJS + Redis | 3004 |
| `historico` | Paso 5: persiste cada evento sin descartar | Kafka → Postgres | (sin API propia) | KafkaJS + PostgreSQL | — |
| `api-publica` | Lectura para terceros, aislada del núcleo | HTTP → `tiempo-real` | `GET /v1/rutas/:rutaId/buses` (rate-limited) | Express + `node-fetch` | 3005 |
| `reportes` | Lectura histórica para el ente gestor | Postgres | `GET /reportes/frecuencia/:rutaId`, `GET /reportes/puntualidad/:rutaId` | Express + PostgreSQL | 3006 |

Cada servicio consumidor de Kafka usa su propio `groupId` (ver
`libs/shared/kafka-client.js`), así que el mismo evento se reparte a los cinco
sin que compitan entre sí, y cada uno decide su propia idempotencia según la
tabla del paso 2 del flujo.

Infraestructura de soporte:

| Componente | Función | Puerto |
|---|---|---:|
| `kafka` | Log durable que distribuye el evento a los consumidores | 9092 |
| `zookeeper` | Coordina Kafka | 2181 |
| `redis` | Estado en tiempo real, ETA y alertas | 6379 |
| `postgres` | Histórico de posiciones | 5433 en el host (5432 dentro de Docker) |

## Cómo correr el sistema completo (Docker)

```bash
docker compose up --build
```

Esto levanta Zookeeper, Kafka, Redis, Postgres y los 7 servicios. Luego se
puede simular un bus reportando posición:

```bash
curl -X POST http://localhost:3001/posiciones \
  -H "Content-Type: application/json" \
  -d '{
    "bus_id": "bus-42",
    "ruta_id": "ruta-1",
    "timestamp": "2026-09-23T10:00:00Z",
    "lat": 7.8891,
    "lon": -72.4967,
    "velocidad_kmh": 25,
    "estado": "EN_RUTA"
  }'
```

Y verificar que se propagó a los demás:

```bash
curl http://localhost:3002/buses/ruta/ruta-1        # mapa en vivo
curl http://localhost:3003/llegadas/ruta-1/p1        # estimación de llegada
curl http://localhost:3004/alertas/activas           # alertas (vacío si no hay anomalía)
curl http://localhost:3005/v1/rutas/ruta-1/buses     # API pública
```

Para simular 10 buses enviando una posición cada 4 segundos, desde PowerShell:

```powershell
.\scripts\simular-gps.ps1
```

El simulador continúa hasta presionar `Ctrl+C`. Para ejecutar solo dos ciclos:

```powershell
.\scripts\simular-gps.ps1 -Ciclos 2
```

Para simular una pérdida de red desde el ciclo 2 durante 7 ciclos (28
segundos), y después reanudar el envío:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\simular-gps.ps1 `
  -Ciclos 10 -CicloInicioSinRed 2 -CiclosSinRed 7
```

Durante la pausa no se publican posiciones. `tiempo-real` conserva el último
estado conocido y el watchdog de `alertas` puede generar `SIN_REPORTAR`; al
volver la red, el siguiente ciclo reanuda la propagación.

Con los contenedores levantados, la prueba de integración verifica salud,
ingesta, fan-out hacia tiempo real/ETA/alertas, API pública, histórico y
validación de entrada:

```powershell
npm run test:integration
```

## Desarrollo sin Docker

Cada servicio referencia `libs/shared` como dependencia local
(`file:../../libs/shared`), así que hay que instalar ahí primero:

```bash
cd libs/shared && npm install && cd ../..
for s in services/*/; do (cd "$s" && npm install); done
```
