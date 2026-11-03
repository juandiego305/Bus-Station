/**
 * Adaptador de prueba del modelo de lenguaje descrito en ADR-002.
 * El asistente debe aplicar su timeout de 2 s al llamar a proponer().
 */
const ESCENARIOS = {
  'propuesta-valida': () => crearPropuesta('ruta-7', 'p-hospital-norte'),
  'parada-inexistente': () => crearPropuesta('ruta-7', 'p-inexistente'),
  'parada-de-otra-ruta': () => crearPropuesta('ruta-8', 'p-hospital-norte'),
  'sin-respuesta': () => new Promise(() => {}),
};

function crearPropuesta(ruta_id, parada_id) {
  return {
    herramienta: 'consultarLlegada',
    argumentos: { ruta_id, parada_id },
  };
}

function crearModeloSimulado({ escenario = 'propuesta-valida' } = {}) {
  const crearRespuesta = ESCENARIOS[escenario];
  if (!crearRespuesta) {
    throw new Error(`escenario de modelo desconocido: ${escenario}`);
  }

  return {
    proponer: async () => crearRespuesta(),
  };
}

module.exports = { crearModeloSimulado };