const express = require('express');
const router = express.Router();

/**
 * GET /reportes/frecuencia/:rutaId?desde=...&hasta=...
 * Cuenta cuantos eventos (proxy de "pasadas" del bus) hubo por franja horaria.
 * Lee siempre del historico, nunca del estado en vivo: el ente gestor
 * tolera datos de ayer, no tolera huecos.
 */
router.get('/frecuencia/:rutaId', async (req, res) => {
  const pool = req.app.get('pool');
  const { desde, hasta } = req.query;

  const { rows } = await pool.query(
    `SELECT date_trunc('hour', ts) AS franja_horaria, count(*) AS eventos
       FROM posiciones_historico
      WHERE ruta_id = $1
        AND ts BETWEEN $2 AND $3
      GROUP BY franja_horaria
      ORDER BY franja_horaria`,
    [req.params.rutaId, desde, hasta]
  );

  res.json({ ruta_id: req.params.rutaId, franjas: rows });
});

/**
 * GET /reportes/puntualidad/:rutaId?parada_id=...&hora_programada=...
 * Placeholder: la puntualidad real requiere el horario programado por
 * parada (no cubierto en este flujo). Se deja el endpoint y la forma de
 * la respuesta para no bloquear el resto de la integracion.
 */
router.get('/puntualidad/:rutaId', async (_req, res) => {
  res.status(501).json({
    error: 'pendiente: requiere el horario programado por parada, fuera de este flujo',
  });
});

module.exports = router;
