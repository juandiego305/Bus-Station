const express = require('express');
const Redis = require('ioredis');
const { TOPICS, crearConsumidorIdempotente } = require('@transporte-vivo/shared/kafka-client');
const busesRouter = require('./routes/buses.route');

async function main() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

  const consumidor = crearConsumidorIdempotente({
    clientId: 'tiempo-real',
    groupId: 'tiempo-real', // grupo propio: no compite por el evento con otros servicios
    topic: TOPICS.POSICION_REPORTADA,
    verEventoProcesado: async (eventoId) => redis.get(`procesado:tiempo-real:${eventoId}`),
    marcarEventoProcesado: async (eventoId) =>
      redis.set(`procesado:tiempo-real:${eventoId}`, '1', 'EX', 60 * 10),
    onEvento: async (evento) => {
      // Last-write-wins: si dos eventos del mismo bus llegan desordenados,
      // solo el mas reciente por timestamp queda como "ultimo estado".
      const clave = `bus:${evento.bus_id}`;
      const actual = await redis.get(clave);
      if (actual) {
        const anterior = JSON.parse(actual);
        if (new Date(anterior.timestamp) > new Date(evento.timestamp)) return;
      }
      await redis.set(clave, JSON.stringify(evento));
      await redis.sadd(`ruta:${evento.ruta_id}:buses`, evento.bus_id);
    },
  });

  await consumidor.iniciar();

  const app = express();
  app.set('redis', redis);
  app.get('/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.use('/buses', busesRouter);

  const puerto = process.env.PUERTO || 3002;
  app.listen(puerto, () => console.log(`tiempo-real escuchando en :${puerto}`));
}

main().catch((err) => {
  console.error('tiempo-real fallo al iniciar', err);
  process.exit(1);
});
