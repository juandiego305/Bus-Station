/**
 * Adaptador en memoria del puerto "RepositorioEstadoBus".
 * En el sistema real este puerto lo implementa Redis (servicio tiempo-real).
 * Los métodos son async para respetar el mismo contrato que tendría Redis.
 */
function crearRepositorioMemoria() {
  const estados = new Map();
  return {
    obtener: async (busId) => estados.get(busId) || null,
    guardar: async (busId, evento) => {
      estados.set(busId, evento);
    },
  };
}

module.exports = { crearRepositorioMemoria };
