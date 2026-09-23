const express = require('express');
const router = express.Router();

// GET /buses/ruta/:rutaId -> ultimo estado de todos los buses de una ruta.
// Esta es la lectura que atienden miles de clientes (Escenario 2): siempre
// contra el ultimo estado publicado, nunca contra una base de datos por-usuario.
router.get('/ruta/:rutaId', async (req, res) => {
  const redis = req.app.get('redis');
  const busIds = await redis.smembers(`ruta:${req.params.rutaId}:buses`);
  const buses = await Promise.all(
    busIds.map(async (id) => JSON.parse((await redis.get(`bus:${id}`)) || 'null'))
  );
  res.set('Cache-Control', 'public, max-age=15'); // frescura ligada a RF-03 (cada 15s)
  res.json({ ruta_id: req.params.rutaId, buses: buses.filter(Boolean) });
});

// GET /buses/:busId -> ultimo estado de un bus puntual.
router.get('/:busId', async (req, res) => {
  const redis = req.app.get('redis');
  const bus = await redis.get(`bus:${req.params.busId}`);
  if (!bus) return res.status(404).json({ error: 'sin datos recientes de este bus' });
  res.set('Cache-Control', 'public, max-age=15');
  res.json(JSON.parse(bus));
});

module.exports = router;
