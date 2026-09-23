/**
 * Calcula el ETA hacia las paradas siguientes de la ruta a partir de una
 * posicion reportada. Es deterministico: mismos insumos, mismo resultado,
 * por eso recalcular el mismo evento dos veces no es un problema (idempotente
 * "por naturaleza", no requiere una clave de deduplicacion adicional).
 *
 * NOTA: la geometria de la ruta (paradas, distancias) esta mockeada aqui.
 * En una implementacion real vendria de un servicio/tabla de rutas.
 */
function calcularEtaPorParada(evento) {
  const PARADAS_MOCK = {
    'ruta-1': [
      { parada_id: 'p1', distancia_km: 1.2 },
      { parada_id: 'p2', distancia_km: 3.5 },
      { parada_id: 'p3', distancia_km: 6.0 },
    ],
  };

  const paradas = PARADAS_MOCK[evento.ruta_id] || [];
  const velocidad = Math.max(evento.velocidad_kmh, 5); // evita division por cero si esta detenido

  return paradas.map((parada) => ({
    parada_id: parada.parada_id,
    ruta_id: evento.ruta_id,
    bus_id: evento.bus_id,
    eta_minutos: Math.round((parada.distancia_km / velocidad) * 60),
  }));
}

module.exports = { calcularEtaPorParada };
