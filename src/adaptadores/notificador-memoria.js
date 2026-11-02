/**
 * Adaptador en memoria del puerto "NotificadorOperador".
 * En el sistema real enviaría la alerta al operador de flota.
 * Aquí solo guarda las alertas para que la prueba pueda contarlas.
 */
function crearNotificadorMemoria() {
  const enviadas = [];
  return {
    enviadas,
    notificar: async (alerta) => {
      enviadas.push(alerta);
    },
  };
}

module.exports = { crearNotificadorMemoria };
