/**
 * Validasi Zod per bagian request. Gagal -> 422 VALIDATION_ERROR.
 * Dua bentuk pemakaian:
 *   validate(schema)            → schema dianggap sebagai body
 *   validate({body, query, params}) → validasi per bagian
 */
const { z } = require('zod');
const { AppError } = require('../utils/AppError');

function validate(input = {}) {
  const isZodSchema = input && typeof input.parse === 'function';
  const sources = isZodSchema ? { body: input } : input;

  return (req, res, next) => {
    try {
      if (sources.body) req.body = sources.body.parse(req.body);
      if (sources.query) req.query = sources.query.parse(req.query);
      if (sources.params) req.params = sources.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        return next(new AppError(422, 'VALIDATION_ERROR', 'Data tidak valid', { details }));
      }
      next(err);
    }
  };
}

module.exports = { validate };
