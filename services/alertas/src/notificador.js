/**
 * Punto unico de salida hacia el operador de flota. Hoy solo loggea;
 * cambiar esto por un webhook de Slack, SMS o push no toca el resto
 * del servicio.
 */
async function notificarOperador(anomalia, evento) {
  console.log(
    `[ALERTA] ${anomalia.tipo} - bus ${anomalia.bus_id} en ruta ${anomalia.ruta_id} ` +
      `(reportado ${evento.timestamp})`
  );
}

module.exports = { notificarOperador };
