const express = require('express');
const router = express.Router();

// GET /alertas/activas -> ultimas alertas para el panel del operador.
router.get('/activas', async (req, res) => {
  const redis = req.app.get('redis');
  const items = await redis.lrange('alertas:activas', 0, 49);
  res.json(items.map((item) => JSON.parse(item)));
});

module.exports = router;
