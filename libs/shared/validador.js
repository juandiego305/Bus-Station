const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const schema = require('./schemas/posicion-reportada.schema.json');

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validarPosicion = ajv.compile(schema);

module.exports = { validarPosicion };