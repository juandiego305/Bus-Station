const express = require('express');
const router = express.Router();

// GET /llegadas/:rutaId/:paradaId -> ultima estimacion calculada.
// Si el consumidor de eventos se atraso, este endpoint sigue respondiendo
// con la ultima estimacion valida (dato desactualizado, nunca vacio).
router.get('/:rutaId/:paradaId', async (req, res) => {
  const redis = req.app.get('redis');
  const dato = await redis.get(`eta:${req.params.rutaId}:${req.params.paradaId}`);
  if (!dato) return res.status(404).json({ error: 'sin estimacion disponible' });
  res.set('Cache-Control', 'public, max-age=15');
  res.json(JSON.parse(dato));
});

module.exports = router;
