/**
 * Fabrica de cliente Kafka compartida por todos los servicios.
 * Centraliza brokers, topic names y la logica de idempotencia de consumo,
 * para que cada servicio solo escriba su logica de negocio.
 */
const { Kafka, logLevel } = require('kafkajs');

const TOPICS = {
  POSICION_REPORTADA: 'posicion-reportada',
};

function crearCliente(clientId) {
  return new Kafka({
    clientId,
    brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
    retry: {
      initialRetryTime: 1000,
      retries: 8,
    },
    logLevel: logLevel.WARN,
  });
}

function parsearEvento(messageValue) {
  if (!messageValue) return null;

  try {
    const evento = JSON.parse(messageValue.toString());

    if (!evento || typeof evento !== 'object' || !evento.evento_id) {
      return null;
    }

    return evento;
  } catch (error) {
    return null;
  }
}

/**
 * Crea un consumer con un groupId propio (cada servicio es un grupo distinto,
 * asi el log se reparte y no se compite por el mismo evento) y expone un
 * helper para consumir con deduplicacion por evento_id.
 */
function crearConsumidorIdempotente({ clientId, groupId, topic, onEvento, verEventoProcesado, marcarEventoProcesado }) {
  const kafka = crearCliente(clientId);
  const consumer = kafka.consumer({ groupId });

  async function iniciar() {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        let evento;
        try {
          evento = parsearEvento(message.value);
          if (!evento) return;

          // Idempotencia: si ya procesamos este evento_id, lo ignoramos.
          const yaProcesado = await verEventoProcesado(evento.evento_id);
          if (yaProcesado) return;

          await onEvento(evento);
          await marcarEventoProcesado(evento.evento_id);
        } catch (err) {
          console.error('fallo procesando evento Kafka', {
            clientId,
            groupId,
            eventoId: evento?.evento_id,
            error: err.message,
          });
          // KafkaJS reintenta el mensaje y conserva el offset sin confirmar.
          throw err;
        }
      },
    });
  }

  return { iniciar, consumer };
}

async function crearProductor(clientId) {
  const kafka = crearCliente(clientId);
  const producer = kafka.producer({ idempotent: true });
  await producer.connect();
  return producer;
}

module.exports = { TOPICS, crearCliente, crearConsumidorIdempotente, crearProductor, parsearEvento };
