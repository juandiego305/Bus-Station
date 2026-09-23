const express = require('express');
const { Pool } = require('pg');
const reportesRouter = require('./routes/reportes.route');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const app = express();
  app.set('pool', pool);
  app.get('/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.use('/reportes', reportesRouter);

  const puerto = process.env.PUERTO || 3006;
  app.listen(puerto, () => console.log(`reportes escuchando en :${puerto}`));
}

main().catch((err) => {
  console.error('reportes fallo al iniciar', err);
  process.exit(1);
});
