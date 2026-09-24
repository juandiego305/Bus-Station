const test = require('node:test');
const assert = require('node:assert/strict');

const baseUrls = {
  gateway: process.env.GATEWAY_URL || 'http://localhost:3001',
  tiempoReal: process.env.TIEMPO_REAL_URL || 'http://localhost:3002',
  estimador: process.env.ESTIMADOR_URL || 'http://localhost:3003',
  alertas: process.env.ALERTAS_URL || 'http://localhost:3004',
  apiPublica: process.env.API_PUBLICA_URL || 'http://localhost:3005',
  reportes: process.env.REPORTES_URL || 'http://localhost:3006',
};

async function requestJson(url, options) {
  const response = await fetch(url, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
}

async function waitFor(description, check, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timeout esperando ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

function posicion(busId, timestamp, estado = 'EN_RUTA') {
  return {
    bus_id: busId,
    ruta_id: 'ruta-1',
    timestamp,
    lat: 7.8891,
    lon: -72.4967,
    velocidad_kmh: estado === 'DETENIDO' ? 0 : 25,
    estado,
  };
}

test('flujo de integración completo', async () => {
  const healthUrls = [
    `${baseUrls.gateway}/salud`,
    `${baseUrls.tiempoReal}/salud`,
    `${baseUrls.estimador}/salud`,
    `${baseUrls.alertas}/salud`,
    `${baseUrls.apiPublica}/salud`,
    `${baseUrls.reportes}/salud`,
  ];

  for (const url of healthUrls) {
    const { response, body } = await requestJson(url);
    assert.equal(response.status, 200, url);
    assert.deepEqual(body, { estado: 'ok' });
  }

  const suffix = `${Date.now()}`;
  const timestamp = new Date().toISOString();
  const busId = `test-${suffix}`;
  const accepted = await requestJson(`${baseUrls.gateway}/posiciones`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(posicion(busId, timestamp)),
  });

  assert.equal(accepted.response.status, 202);
  assert.equal(accepted.body.recibido, true);

  const realtime = await waitFor(`tiempo-real para ${busId}`, async () => {
    const result = await requestJson(`${baseUrls.tiempoReal}/buses/${busId}`);
    return result.response.status === 200 && result.body;
  });
  assert.equal(realtime.evento_id, `${busId}:${timestamp}`);

  const eta = await waitFor(`ETA para ${busId}`, async () => {
    const result = await requestJson(`${baseUrls.estimador}/llegadas/ruta-1/p1`);
    return result.response.status === 200 && result.body.bus_id === busId ? result : null;
  });
  assert.equal(eta.body.parada_id, 'p1');

  const alertBusId = `alert-${suffix}`;
  const alertTimestamp = new Date(Date.now() + 1000).toISOString();
  const alertAccepted = await requestJson(`${baseUrls.gateway}/posiciones`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(posicion(alertBusId, alertTimestamp, 'DETENIDO')),
  });
  assert.equal(alertAccepted.response.status, 202);

  const alerts = await waitFor(`alerta para ${alertBusId}`, async () => {
    const result = await requestJson(`${baseUrls.alertas}/alertas/activas`);
    const found = Array.isArray(result.body) && result.body.some((item) => item.bus_id === alertBusId);
    return result.response.status === 200 && found ? result : null;
  });
  assert.equal(alerts.response.status, 200);

  const publicApi = await waitFor(`API pública para ${busId}`, async () => {
    const result = await requestJson(`${baseUrls.apiPublica}/v1/rutas/ruta-1/buses`);
    const found = result.body?.buses?.some((item) => item.bus_id === busId);
    return result.response.status === 200 && found ? result : null;
  });
  assert.equal(publicApi.response.status, 200);

  const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const report = await waitFor('reporte histórico', async () => {
    const result = await requestJson(
      `${baseUrls.reportes}/reportes/frecuencia/ruta-1?desde=${encodeURIComponent(from)}&hasta=${encodeURIComponent(to)}`
    );
    const found = result.body?.franjas?.some((franja) => Number(franja.eventos) > 0);
    return result.response.status === 200 && found ? result : null;
  });
  assert.equal(report.response.status, 200);

  const invalid = await requestJson(`${baseUrls.gateway}/posiciones`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(invalid.response.status, 400);
});