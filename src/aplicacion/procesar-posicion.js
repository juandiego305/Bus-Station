/**
 * Caso de uso: procesar una PosicionReportada en el camino de tiempo real
 * (último estado del bus + alerta al operador).
 *
 * Solo depende de puertos (repo y notificador), no de Redis ni de Kafka:
 * por eso se puede probar con adaptadores en memoria.
 *
 * VERSIÓN INICIAL, SIN TÁCTICA: guarda el último evento que LLEGA.
 */
const ANOMALIAS = { DETENIDO: 'BUS_DETENIDO', FUERA_DE_RUTA: 'FUERA_DE_RUTA' };

function crearProcesador({ repo, notificador }) {
  return async function procesar(evento) {
    await repo.guardar(evento.bus_id, evento);

    const tipo = ANOMALIAS[evento.estado];
    if (tipo) {
      await notificador.notificar({
        tipo,
        bus_id: evento.bus_id,
        ruta_id: evento.ruta_id,
        timestamp: evento.timestamp,
      });
    }
    return 'aplicado';
  };
}

module.exports = { crearProcesador };
