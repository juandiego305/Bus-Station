const HERRAMIENTA_PERMITIDA = 'consultarLlegada';

function rechazar(motivo) {
  return { aceptada: false, motivo };
}

function validarPropuesta(propuesta, rutas) {
  if (propuesta?.herramienta !== HERRAMIENTA_PERMITIDA) {
    return rechazar('herramienta_no_permitida');
  }

  const { ruta_id, parada_id } = propuesta.argumentos || {};
  if (typeof ruta_id !== 'string' || !Object.hasOwn(rutas, ruta_id)) {
    return rechazar('ruta_inexistente');
  }

  if (typeof parada_id !== 'string') {
    return rechazar('parada_inexistente');
  }

  const paradasRuta = rutas[ruta_id];
  const paradaExiste = Object.values(rutas).some(
    (paradas) => Array.isArray(paradas) && paradas.includes(parada_id),
  );

  if (!paradaExiste) return rechazar('parada_inexistente');
  if (!Array.isArray(paradasRuta) || !paradasRuta.includes(parada_id)) {
    return rechazar('parada_de_otra_ruta');
  }

  return { aceptada: true, ruta_id, parada_id };
}

async function resolverPropuestaConTimeout(modelo, rutas, timeoutMs = 2000) {
  let temporizador;
  const resultado = await Promise.race([
    Promise.resolve()
      .then(() => modelo.proponer())
      .then((propuesta) => ({ propuesta }))
      .catch(() => ({ error: true })),
    new Promise((resolve) => {
      temporizador = setTimeout(() => resolve({ timeout: true }), timeoutMs);
    }),
  ]);
  clearTimeout(temporizador);

  if (resultado.timeout) return { destino: 'selector', motivo: 'timeout' };
  if (resultado.error) return { destino: 'selector', motivo: 'error_modelo' };

  const validacion = validarPropuesta(resultado.propuesta, rutas);
  if (!validacion.aceptada) {
    return { destino: 'selector', motivo: validacion.motivo };
  }

  return {
    destino: 'llegada',
    ruta_id: validacion.ruta_id,
    parada_id: validacion.parada_id,
  };
}

module.exports = { validarPropuesta, resolverPropuestaConTimeout };