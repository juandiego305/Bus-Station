/**
 * Caso de uso: procesar una PosicionReportada en el camino de tiempo real
 * (último estado del bus + alerta al operador).
 *
 * Solo depende de puertos (repo y notificador), no de Redis ni de Kafka:
 * por eso se puede probar con adaptadores en memoria.
 *
 * VERSIÓN CON TÁCTICA (last-write-wins por timestamp): antes de guardar,
 * lee el estado anterior del bus y descarta el evento si su timestamp es
 * menor ('atrasado') o igual ('duplicado'). Así gana el evento más RECIENTE,
 * no el último que LLEGA, y un duplicado no vuelve a disparar la alerta.
 */
const ANOMALIAS = { DETENIDO: 'BUS_DETENIDO', FUERA_DE_RUTA: 'FUERA_DE_RUTA' };

function crearProcesador({ repo, notificador }) {
  return async function procesar(evento) {
    const anterior = await repo.obtener(evento.bus_id);
    if (anterior) {
      const nuevo = Date.parse(evento.timestamp);
      const previo = Date.parse(anterior.timestamp);
      if (nuevo < previo) return 'atrasado';
      if (nuevo === previo) return 'duplicado';
    }
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
