const { Pool } = require('pg');
const { TOPICS, crearConsumidorIdempotente } = require('@transporte-vivo/shared/kafka-client');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posiciones_historico (
      evento_id TEXT PRIMARY KEY, -- la propia clave de idempotencia es la PK
      bus_id TEXT NOT NULL,
      ruta_id TEXT,
      ts TIMESTAMPTZ NOT NULL,
      lat DOUBLE PRECISION,
      lon DOUBLE PRECISION,
      velocidad_kmh DOUBLE PRECISION,
      estado TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_historico_ruta_ts ON posiciones_historico (ruta_id, ts);
  `);

  const consumidor = crearConsumidorIdempotente({
    clientId: 'historico',
    groupId: 'historico',
    topic: TOPICS.POSICION_REPORTADA,
    // La idempotencia aqui es un simple UPSERT: si el evento_id ya existe,
    // no se duplica la fila en los reportes de puntualidad/frecuencia.
    verEventoProcesado: async () => false, // deja que el UPSERT decida
    marcarEventoProcesado: async () => {},
    onEvento: async (evento) => {
      await pool.query(
        `INSERT INTO posiciones_historico
           (evento_id, bus_id, ruta_id, ts, lat, lon, velocidad_kmh, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (evento_id) DO NOTHING`,
        [
          evento.evento_id,
          evento.bus_id,
          evento.ruta_id,
          evento.timestamp,
          evento.lat,
          evento.lon,
          evento.velocidad_kmh,
          evento.estado,
        ]
      );
    },
  });

  await consumidor.iniciar();
  console.log('historico consumiendo posicion-reportada');
}

main().catch((err) => {
  console.error('historico fallo al iniciar', err);
  process.exit(1);
});
