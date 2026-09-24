/**
 * Reglas simples de deteccion. `evento.estado` ya viene calculado por el
 * propio dispositivo GPS; aqui solo lo traducimos a una alerta con tipo,
 * o devolvemos null si no hay nada anormal que reportar.
 */
function detectarAnomalia(evento) {
  if (evento.estado === 'DETENIDO') {
    return { tipo: 'BUS_DETENIDO', bus_id: evento.bus_id, ruta_id: evento.ruta_id };
  }
  if (evento.estado === 'FUERA_DE_RUTA') {
    return { tipo: 'FUERA_DE_RUTA', bus_id: evento.bus_id, ruta_id: evento.ruta_id };
  }
  if (evento.estado === 'SIN_REPORTAR') {
    return { tipo: 'SIN_REPORTAR', bus_id: evento.bus_id, ruta_id: evento.ruta_id };
  }
  return null;
}

module.exports = { detectarAnomalia };
