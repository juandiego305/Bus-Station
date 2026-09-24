const test = require('node:test');
const assert = require('node:assert/strict');

const { parsearEvento } = require('../kafka-client');

test('parsea un evento valido de Kafka', () => {
  const evento = parsearEvento(Buffer.from(JSON.stringify({
    evento_id: 'evt-001',
    bus_id: 'bus-10',
    ruta_id: 'ruta-1',
    estado: 'EN_RUTA',
  })));

  assert.deepEqual(evento, {
    evento_id: 'evt-001',
    bus_id: 'bus-10',
    ruta_id: 'ruta-1',
    estado: 'EN_RUTA',
  });
});

test('ignora mensajes invalidos o sin evento_id', () => {
  assert.equal(parsearEvento(Buffer.from('no-es-json')), null);
  assert.equal(parsearEvento(Buffer.from(JSON.stringify({ bus_id: 'bus-11' }))), null);
  assert.equal(parsearEvento(null), null);
});
