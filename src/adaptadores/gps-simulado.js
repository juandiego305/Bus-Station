/**
 * Adaptador simulado del GPS de la flota y de la red celular.
 * Es el mecanismo que reproduce la falla del escenario a voluntad.
 *
 * Modos:
 *  - "sin-falla":        los eventos llegan en orden y una sola vez.
 *  - "con-falla":        la red celular atrasa y duplica eventos.
 *  - "reloj-adelantado": un bus envía UNA posición con el reloj una hora
 *                        adelantado (muestra el costo de la táctica).
 *
 * Datos del caso: 350 buses, un reporte cada 4 s, atrasos de hasta 3 minutos.
 * Supuestos declarados: el 20 % de los eventos llega atrasado y el 10 % llega
 * duplicado (el caso no da el porcentaje; ver README).
 */

// Generador pseudoaleatorio con semilla: la misma ráfaga en cada ejecución.
function crearAleatorio(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const ESTADOS = ['EN_RUTA', 'EN_RUTA', 'EN_RUTA', 'EN_RUTA', 'DETENIDO', 'FUERA_DE_RUTA'];

function generarRafaga({
  modo = 'con-falla',
  buses = 350,
  intervaloSeg = 4,
  ventanaSeg = 180,
  pctAtrasados = 0.2,
  pctDuplicados = 0.1,
  atrasoMaxSeg = 180,
  semilla = 42,
} = {}) {
  const azar = crearAleatorio(semilla);
  const inicio = Date.parse('2026-11-05T07:00:00Z');
  const eventos = [];

  for (let r = 0; r < ventanaSeg / intervaloSeg; r++) {
    for (let b = 1; b <= buses; b++) {
      eventos.push({
        bus_id: `bus-${b}`,
        ruta_id: `ruta-${(b % 20) + 1}`,
        timestamp: new Date(inicio + r * intervaloSeg * 1000).toISOString(),
        velocidad_kmh: Math.round(azar() * 50),
        estado: ESTADOS[Math.floor(azar() * ESTADOS.length)],
      });
    }
  }

  // Momento en que cada evento LLEGA al sistema (sin red celular: en orden).
  let llegadas = eventos.map((e) => ({ evento: e, llega: Date.parse(e.timestamp) }));

  if (modo === 'con-falla') {
    for (const l of llegadas) {
      if (azar() < pctAtrasados) l.llega += 1000 + azar() * atrasoMaxSeg * 1000;
    }
    const duplicados = llegadas
      .filter(() => azar() < pctDuplicados)
      .map((l) => ({ evento: { ...l.evento }, llega: l.llega + azar() * 10000 }));
    llegadas = llegadas.concat(duplicados);
  }

  if (modo === 'reloj-adelantado') {
    const primero = llegadas.find((l) => l.evento.bus_id === 'bus-1');
    const adelantado = Date.parse(primero.evento.timestamp) + 3600 * 1000;
    primero.evento.timestamp = new Date(adelantado).toISOString();
    primero.evento.relojAdelantado = true; // marca solo para la verificación
  }

  llegadas.sort((a, b) => a.llega - b.llega);
  return llegadas.map((l) => l.evento);
}

module.exports = { generarRafaga };
