# Sistema de Transporte Público en Vivo

Implementación de la arquitectura orientada a eventos definida en `docs/adr/ADR-000` y el
flujo descrito en `docs/flujo-transporte.md`. Un único evento de entrada
(`PosicionReportada`) se publica en Kafka; todo lo demás son consumidores
independientes de ese evento, cada uno con su propio contrato de consistencia.

## Mapa de servicios

| Servicio | Rol en el flujo | Lee de | Expone |
|---|---|---|---|
| `gateway-ingesta` | Paso 1: recibe el POST del GPS y publica el evento | — | `POST /posiciones` |
| `tiempo-real` | Paso 2: mantiene el último estado por bus (last-write-wins) | Kafka → Redis | `GET /buses/ruta/:rutaId`, `GET /buses/:busId` |
| `estimador-llegadas` | Paso 3: recalcula ETA por parada | Kafka → Redis | `GET /llegadas/:rutaId/:paradaId` |
| `alertas` | Paso 4: detecta anomalías y notifica al operador | Kafka + watchdog → Redis | `GET /alertas/activas` |
| `historico` | Paso 5: persiste cada evento sin descartar | Kafka → Postgres | (sin API propia) |
| `reportes` | Lectura para el ente gestor | Postgres | `GET /reportes/frecuencia/:rutaId` |
| `api-publica` | Lectura para terceros, aislada del núcleo | HTTP → `tiempo-real` | `GET /v1/rutas/:rutaId/buses` (rate-limited) |

Cada servicio consumidor de Kafka usa su propio `groupId` (ver
`libs/shared/kafka-client.js`), así que el mismo evento se reparte a los cinco
sin que compitan entre sí, y cada uno decide su propia idempotencia según la
tabla del paso 2 del flujo.

## Matriz arquitectónica

| Bloque | Servicio | Responsabilidad | Endpoint | Tecnología | Puerto |
|---|---|---|---|---|---:|
| Ingesta | `gateway-ingesta` | Recibe posiciones GPS y publica eventos | `POST /posiciones` | Express + KafkaJS | 3001 |
| Broker + eventos | `kafka` | Distribuye eventos a los consumidores | Interno | Kafka | 9092 |
| Tiempo real / caché | `tiempo-real` | Mantiene el último estado conocido de cada bus | `GET /buses/:busId`, `GET /buses/ruta/:rutaId` | Express + KafkaJS + Redis | 3002 |
| Estimación | `estimador-llegadas` | Calcula tiempos estimados de llegada | `GET /llegadas/:rutaId/:paradaId` | Express + KafkaJS + Redis | 3003 |
| Alertas | `alertas` | Detecta buses detenidos, fuera de ruta o sin reportar | `GET /alertas/activas` | Express + KafkaJS + Redis | 3004 |
| Histórico | `historico` | Guarda las posiciones en PostgreSQL | Interno, consumidor Kafka | KafkaJS + PostgreSQL | — |
| API de lectura | `api-publica` | Expone información para clientes externos | `GET /v1/rutas/:rutaId/buses` | Express + `node-fetch` | 3005 |
| Reportes | `reportes` | Consulta información histórica y genera reportes | `GET /reportes/frecuencia/:rutaId`, `GET /reportes/puntualidad/:rutaId` | Express + PostgreSQL | 3006 |

## Infraestructura de soporte

| Componente | Función | Puerto |
|---|---|---:|
| `zookeeper` | Coordina Kafka | 2181 |
| `redis` | Almacena caché, estado en tiempo real, ETA y alertas | 6379 |
| `postgres` | Almacena el histórico de posiciones | 5432 |

No falta ningún bloque principal de la arquitectura. `reportes` es un servicio
adicional de lectura que complementa la `api-publica` con consultas históricas.

## Cómo correr localmente

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

## Instalar dependencias por servicio (desarrollo sin Docker)

Cada servicio referencia `libs/shared` como dependencia local
(`file:../../libs/shared`), así que hay que instalar ahí primero:

```bash
cd libs/shared && npm install && cd ../..
for s in services/*/; do (cd "$s" && npm install); done
```

## Dónde está cada decisión

- El **porqué** de la arquitectura: `docs/adr/ADR-000-arquitectura-eventos.md`
- El **flujo paso a paso** con síncrono/evento/idempotencia: `docs/flujo-transporte.md`
- La **vista de contenedores C4** (DSL e imagen): `docs/contenedores.dsl` y `docs/img/Contenedores.png`
