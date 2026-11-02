/**
 * Prueba del escenario de calidad: consistencia del camino en vivo
 * frente a eventos atrasados y duplicados por la red celular.
 *
 * Medida: en una ventana de 3 minutos de operación (350 buses, un reporte
 * cada 4 s = 15.750 eventos), con el 20 % de los eventos atrasados hasta 180 s
 * y el 10 % duplicados, el 100 % de los buses queda con su posición más
 * reciente y el operador no recibe ninguna alerta duplicada.
 *
 * Uso: node test/escenario-desorden.js <con-falla | sin-falla | reloj-adelantado>
 */
const { generarRafaga } = require('../src/adaptadores/gps-simulado');
const { crearRepositorioMemoria } = require('../src/adaptadores/repositorio-memoria');
const { crearNotificadorMemoria } = require('../src/adaptadores/notificador-memoria');
const { crearProcesador } = require('../src/aplicacion/procesar-posicion');

async function main() {
  const modo = process.argv[2] || 'con-falla';
  const eventos = generarRafaga({ modo });
  const repo = crearRepositorioMemoria();
  const notificador = crearNotificadorMemoria();
  const procesar = crearProcesador({ repo, notificador });

  // 1. Procesar la ráfaga midiendo el tiempo de cada evento (costo de la táctica).
  const tiemposUs = [];
  for (const evento of eventos) {
    const t0 = process.hrtime.bigint();
    await procesar(evento);
    tiemposUs.push(Number(process.hrtime.bigint() - t0) / 1000);
  }

  // 2. Estado esperado: la posición con el timestamp más reciente de cada bus
  //    (sin contar la posición con el reloj adelantado, que no es real).
  const esperado = new Map();
  for (const e of eventos) {
    if (e.relojAdelantado) continue;
    const previo = esperado.get(e.bus_id);
    if (!previo || Date.parse(e.timestamp) > Date.parse(previo.timestamp)) esperado.set(e.bus_id, e);
  }

  let correctos = 0;
  for (const [busId, e] of esperado) {
    const guardado = await repo.obtener(busId);
    if (guardado && guardado.timestamp === e.timestamp) correctos++;
  }
  const pctCorrectos = (correctos / esperado.size) * 100;

  // 3. Alertas duplicadas: misma alerta para el mismo bus y el mismo instante.
  const vistas = new Set();
  let duplicadas = 0;
  for (const a of notificador.enviadas) {
    const clave = `${a.bus_id}|${a.tipo}|${a.timestamp}`;
    if (vistas.has(clave)) duplicadas++;
    vistas.add(clave);
  }

  const ordenados = [...tiemposUs].sort((a, b) => a - b);
  const promedio = tiemposUs.reduce((s, t) => s + t, 0) / tiemposUs.length;
  const p99 = ordenados[Math.floor(ordenados.length * 0.99)];

  console.log(`Modo: ${modo}`);
  console.log(`Eventos procesados: ${eventos.length}`);
  console.log(`Buses con su posición más reciente: ${correctos}/${esperado.size} (${pctCorrectos.toFixed(1)} %)`);
  console.log(`Alertas enviadas: ${notificador.enviadas.length}, duplicadas: ${duplicadas}`);
  console.log(`Tiempo por evento: promedio ${promedio.toFixed(2)} µs, p99 ${p99.toFixed(2)} µs`);

  const cumple = pctCorrectos === 100 && duplicadas === 0;
  console.log(cumple ? '\nESCENARIO CUMPLIDO' : '\nESCENARIO NO CUMPLIDO: la medida exige 100 % y 0 alertas duplicadas');
  process.exitCode = cumple ? 0 : 1;
}

main();
