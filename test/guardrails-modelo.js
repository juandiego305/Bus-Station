const assert = require('node:assert/strict');
const { crearModeloSimulado } = require('../src/adaptadores/modelo-simulado');
const {
  resolverPropuestaConTimeout,
  validarPropuesta,
} = require('../src/aplicacion/validar-propuesta');

const rutas = {
  'ruta-7': ['p-hospital-norte', 'p-terminal'],
  'ruta-8': ['p-universidad'],
};

async function main() {
  const propuestaValida = await crearModeloSimulado({ escenario: 'propuesta-valida' }).proponer();
  assert.deepEqual(validarPropuesta(propuestaValida, rutas), {
    aceptada: true,
    ruta_id: 'ruta-7',
    parada_id: 'p-hospital-norte',
  });

  const propuestasInvalidas = [
    await crearModeloSimulado({ escenario: 'parada-inexistente' }).proponer(),
    await crearModeloSimulado({ escenario: 'parada-de-otra-ruta' }).proponer(),
    {
      herramienta: 'consultarHorario',
      argumentos: { ruta_id: 'ruta-7', parada_id: 'p-hospital-norte' },
    },
    {
      herramienta: 'consultarLlegada',
      argumentos: { ruta_id: 'ruta-inexistente', parada_id: 'p-hospital-norte' },
    },
  ];

  const rechazadas = propuestasInvalidas.filter(
    (propuesta) => !validarPropuesta(propuesta, rutas).aceptada,
  ).length;
  assert.equal(rechazadas, propuestasInvalidas.length);

  const resultadoTimeout = await resolverPropuestaConTimeout(
    crearModeloSimulado({ escenario: 'sin-respuesta' }),
    rutas,
  );
  assert.deepEqual(resultadoTimeout, { destino: 'selector', motivo: 'timeout' });

  console.log(`Propuestas inválidas rechazadas: ${rechazadas}/${propuestasInvalidas.length}`);
  console.log('Timeout de 2 s: termina en el selector');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});