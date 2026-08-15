/** 404 untuk route yang tidak dikenal. */
const { AppError } = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} tidak ditemukan`));
}

module.exports = { notFound };
