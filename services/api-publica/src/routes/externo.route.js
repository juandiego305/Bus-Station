const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const TIEMPO_REAL_URL = process.env.TIEMPO_REAL_URL || 'http://tiempo-real:3002';

// GET /v1/rutas/:rutaId/buses -> mismo dato que consume la app, pero por
// un contrato publico y versionado, aislado del servicio interno.
router.get('/rutas/:rutaId/buses', async (req, res) => {
  const resp = await fetch(`${TIEMPO_REAL_URL}/buses/ruta/${req.params.rutaId}`);
  const data = await resp.json();
  res.status(resp.status).json(data);
});

module.exports = router;
