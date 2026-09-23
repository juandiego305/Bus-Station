const express = require('express');
const { crearProductor } = require('@transporte-vivo/shared/kafka-client');
const posicionRouter = require('./routes/posicion.route');

async function main() {
  const app = express();
  app.use(express.json());

  const productor = await crearProductor('gateway-ingesta');
  app.set('productor', productor);

  app.get('/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.use('/posiciones', posicionRouter);

  const puerto = process.env.PUERTO || 3001;
  app.listen(puerto, () => console.log(`gateway-ingesta escuchando en :${puerto}`));
}

main().catch((err) => {
  console.error('gateway-ingesta fallo al iniciar', err);
  process.exit(1);
});
