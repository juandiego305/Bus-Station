const express = require('express');
const Redis = require('ioredis');
const { TOPICS, crearConsumidorIdempotente } = require('@transporte-vivo/shared/kafka-client');
const alertasRouter = require('./routes/alertas.route');
const { detectarAnomalia } = require('./detector');
const { notificarOperador } = require('./notificador');
const { iniciarWatchdog } = require('./watchdog');

async function main() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

  const consumidor = crearConsumidorIdempotente({
    clientId: 'alertas',
    groupId: 'alertas',
    topic: TOPICS.POSICION_REPORTADA,
    verEventoProcesado: async (eventoId) => redis.get(`procesado:alertas:${eventoId}`),
    marcarEventoProcesado: async (eventoId) =>
      redis.set(`procesado:alertas:${eventoId}`, '1', 'EX', 60 * 10),
    onEvento: async (evento) => {
      const anomalia = detectarAnomalia(evento);
      if (!anomalia) return;

      // Idempotencia por (bus_id, tipo_alerta, ventana de 5 min): si el bus
      // sigue detenido y el GPS reporta cada 4s, no mandamos 75 alertas en
      // 5 minutos, mandamos una y la mantenemos activa.
      const ventana = Math.floor(Date.now() / (5 * 60 * 1000));
      const claveAlerta = `alerta:${evento.bus_id}:${anomalia.tipo}:${ventana}`;
      const yaAlertado = await redis.get(claveAlerta);
      if (yaAlertado) return;

      await redis.set(claveAlerta, '1', 'EX', 5 * 60);
      await redis.lpush('alertas:activas', JSON.stringify({ ...anomalia, evento }));

      try {
        await notificarOperador(anomalia, evento);
      } catch (err) {
        // Reintenta el consumo (kafkajs) y, si sigue fallando, la alerta ya
        // quedo registrada en 'alertas:activas' como respaldo secundario.
        console.error('no se pudo notificar al operador, queda registrada', err);
      }
    },
  });

  await consumidor.iniciar();

  iniciarWatchdog({
    redis,
    onSinReportar: (anomalia) => notificarOperador(anomalia, { timestamp: new Date().toISOString() }),
  });

  const app = express();
  app.set('redis', redis);
  app.get('/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.use('/alertas', alertasRouter);

  const puerto = process.env.PUERTO || 3004;
  app.listen(puerto, () => console.log(`alertas escuchando en :${puerto}`));
}

main().catch((err) => {
  console.error('alertas fallo al iniciar', err);
  process.exit(1);
});
