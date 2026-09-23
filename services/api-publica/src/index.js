const express = require('express');
const rateLimit = require('express-rate-limit');
const externoRouter = require('./routes/externo.route');

async function main() {
  const app = express();

  // Limite de tasa por API key/IP: terceros no pueden competir por los
  // mismos recursos que el sistema interno (RF-08 / restriccion del caso).
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.use('/v1', externoRouter);

  const puerto = process.env.PUERTO || 3005;
  app.listen(puerto, () => console.log(`api-publica escuchando en :${puerto}`));
}

main().catch((err) => {
  console.error('api-publica fallo al iniciar', err);
  process.exit(1);
});
