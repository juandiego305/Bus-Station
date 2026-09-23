/**
 * La anomalia "SIN_REPORTAR" es distinta de las demas: no viene marcada en
 * ningun evento, se detecta por la AUSENCIA de eventos. Por eso no vive en
 * detector.js (que reacciona a un evento) sino en un job periodico que
 * revisa cuando fue la ultima vez que se vio a cada bus.
 *
 * Se apoya en el mismo estado que expone tiempo-real (bus:<id> con su
 * timestamp), leido aqui de solo lectura.
 */
function iniciarWatchdog({ redis, umbralSegundos = 20, intervaloMs = 15000, onSinReportar }) {
  return setInterval(async () => {
    const claves = await redis.keys('bus:*');
    const ahora = Date.now();

    for (const clave of claves) {
      const bus = JSON.parse((await redis.get(clave)) || 'null');
      if (!bus) continue;

      const segundosSinReportar = (ahora - new Date(bus.timestamp).getTime()) / 1000;
      if (segundosSinReportar < umbralSegundos) continue;

      const claveAlerta = `alerta:${bus.bus_id}:SIN_REPORTAR:${Math.floor(ahora / (5 * 60 * 1000))}`;
      const yaAlertado = await redis.get(claveAlerta);
      if (yaAlertado) continue;

      await redis.set(claveAlerta, '1', 'EX', 5 * 60);
      await onSinReportar({ tipo: 'SIN_REPORTAR', bus_id: bus.bus_id, ruta_id: bus.ruta_id });
    }
  }, intervaloMs);
}

module.exports = { iniciarWatchdog };
