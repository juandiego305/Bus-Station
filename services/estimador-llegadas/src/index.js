const express = require('express');
const Redis = require('ioredis');
const { TOPICS, crearConsumidorIdempotente } = require('@transporte-vivo/shared/kafka-client');
const { calcularEtaPorParada } = require('./eta');
const llegadasRouter = require('./routes/llegadas.route');

async function main() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

  const consumidor = crearConsumidorIdempotente({
    clientId: 'estimador-llegadas',
    groupId: 'estimador-llegadas',
    topic: TOPICS.POSICION_REPORTADA,
    verEventoProcesado: async (eventoId) => redis.get(`procesado:estimador:${eventoId}`),
    marcarEventoProcesado: async (eventoId) =>
      redis.set(`procesado:estimador:${eventoId}`, '1', 'EX', 60 * 10),
    onEvento: async (evento) => {
      // Funcion pura sobre la posicion + geometria de la ruta (mock aqui,
      // en produccion vendria de un servicio de rutas/paradas).
      const estimaciones = calcularEtaPorParada(evento);
      for (const est of estimaciones) {
        await redis.set(
          `eta:${evento.ruta_id}:${est.parada_id}`,
          JSON.stringify({ ...est, actualizado_en: evento.timestamp }),
          'EX',
          60 * 5 // si nadie actualiza en 5 min, el dato expira en vez de mentir
        );
      }
    },
  });

  await consumidor.iniciar();

  const app = express();
  app.set('redis', redis);
  app.get('/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.use('/llegadas', llegadasRouter);

  const puerto = process.env.PUERTO || 3003;
  app.listen(puerto, () => console.log(`estimador-llegadas escuchando en :${puerto}`));
}

main().catch((err) => {
  console.error('estimador-llegadas fallo al iniciar', err);
  process.exit(1);
});
