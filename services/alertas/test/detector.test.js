const test = require('node:test');
const assert = require('node:assert/strict');
const { detectarAnomalia } = require('../src/detector');

test('detecta bus detenido', () => {
  const resultado = detectarAnomalia({
    bus_id: 'bus-10',
    ruta_id: 'ruta-1',
    estado: 'DETENIDO',
  });

  assert.deepEqual(resultado, {
    tipo: 'BUS_DETENIDO',
    bus_id: 'bus-10',
    ruta_id: 'ruta-1',
  });
});

test('detecta bus fuera de ruta', () => {
  const resultado = detectarAnomalia({
    bus_id: 'bus-11',
    ruta_id: 'ruta-2',
    estado: 'FUERA_DE_RUTA',
  });

  assert.deepEqual(resultado, {
    tipo: 'FUERA_DE_RUTA',
    bus_id: 'bus-11',
    ruta_id: 'ruta-2',
  });
});

test('detecta bus sin reportar', () => {
  const resultado = detectarAnomalia({
    bus_id: 'bus-12',
    ruta_id: 'ruta-3',
    estado: 'SIN_REPORTAR',
  });

  assert.deepEqual(resultado, {
    tipo: 'SIN_REPORTAR',
    bus_id: 'bus-12',
    ruta_id: 'ruta-3',
  });
});

test('ignora eventos normales', () => {
  const resultado = detectarAnomalia({
    bus_id: 'bus-13',
    ruta_id: 'ruta-4',
    estado: 'EN_RUTA',
  });

  assert.equal(resultado, null);
});
