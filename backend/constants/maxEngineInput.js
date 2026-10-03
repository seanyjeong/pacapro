const Joi = require('joi');
const text = max => Joi.string().max(max).allow('', null);
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((v, h) =>
  !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : h.error('any.invalid'));
const id = Joi.number().integer().positive();
module.exports = { Joi, text, date, id };
