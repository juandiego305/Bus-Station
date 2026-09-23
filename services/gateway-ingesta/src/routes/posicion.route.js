const express = require('express');
const { TOPICS } = require('@transporte-vivo/shared/kafka-client');

const router = express.Router();

/**
 * POST /posiciones
 * El GPS solo espera un ACK de recepcion (evento, no sincrono):
 * no bloqueamos la respuesta a que el mapa, la estimacion o las
 * alertas terminen de procesar el dato (ver flujo-transporte.md, paso 1).
 */
router.post('/', async (req, res) => {
  const { bus_id, ruta_id, timestamp, lat, lon, velocidad_kmh, estado } = req.body;

  if (!bus_id || !timestamp || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'faltan campos obligatorios' });
  }

  const evento = {
    // Clave de idempotencia para todos los consumidores.
    evento_id: `${bus_id}:${timestamp}`,
    bus_id,
    ruta_id,
    timestamp,
    lat,
    lon,
    velocidad_kmh,
    estado: estado || 'EN_RUTA',
  };

  const productor = req.app.get('productor');
  try {
    await productor.send({
      topic: TOPICS.POSICION_REPORTADA,
      messages: [{ key: bus_id, value: JSON.stringify(evento) }],
    });
    // ACK inmediato: el evento ya quedo en el log, el resto del
    // procesamiento ocurre de forma asincrona en otros servicios.
    return res.status(202).json({ recibido: true, evento_id: evento.evento_id });
  } catch (err) {
    // Si el log no esta disponible, el GPS reintentara en su
    // siguiente ciclo (4s despues); no hay nada que compensar aqui.
    console.error('no se pudo publicar el evento', err);
    return res.status(503).json({ error: 'no se pudo encolar el evento, reintente' });
  }
});

module.exports = router;
