/**
 * Central error handler — respons JSON konsisten:
 *   { error: { code, message, details? } }
 * Kecuali error punya `extra` (kontrak khusus, mis. 409 alreadyPaid di payments)
 *   -> body = extra (sesuai kontrak UI 03 §7.1).
 */
const mongoose = require('mongoose');
const multer = require('multer');
const { AppError } = require('../utils/AppError');
const { MAX_FILE_SIZE, TOOLBOX_MAX_FILE_SIZE } = require('../utils/multer');
const { logger } = require('../config/logger');
const { env } = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Terjadi kesalahan internal';
  let details;
  let extra = err.extra;

  // Multer: ukuran file melebihi batas (pesan menyebut KEDUA batas — toolbox 50MB,
  // route lain 25MB; batas spesifik tergantung route yang memicu)
  if (err instanceof multer.MulterError) {
    statusCode = 413;
    code = 'FILE_TOO_LARGE';
    message = `File terlalu besar — maksimal ${Math.round(TOOLBOX_MAX_FILE_SIZE / (1024 * 1024))} MB untuk toolbox, ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB untuk lainnya`;
  }

  // Mongoose CastError (ObjectId tidak valid)
  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'ID tidak valid';
  }

  // Mongoose duplicate key (mis. email unique, midtransOrderId unique)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE';
    const key = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Data dengan nilai yang sama sudah ada (${key})`;
  }

  // ValidationError mongoose (schema-level)
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Data tidak valid';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  if (statusCode >= 500) {
    logger.error({ err }, `[error] ${code}: ${message}`);
  } else {
    logger.warn({ err }, `[error-handled] ${statusCode} ${code}: ${message}`);
  }

  // Best practice: di PRODUCTION jangan bocorkan detail internal error 5xx
  // (err.message bisa berisi path/detail library). Detail tetap ada di log di atas.
  if (statusCode >= 500 && env.NODE_ENV === 'production') {
    message = 'Terjadi kesalahan internal';
  }

  if (extra && typeof extra === 'object') {
    // Kontrak khusus: mis. { alreadyPaid: true, finalPdfUrl } — bukan envelope error
    return res.status(statusCode).json({ ...extra, error: { code, message } });
  }

  const body = { error: { code, message } };
  if (details) body.error.details = details;
  // Jangan bocorkan stack di production
  if (env.NODE_ENV === 'development' && err.stack) {
    body.error.stack = err.stack.split('\n').slice(0, 6);
  }
  return res.status(statusCode).json(body);
}

module.exports = { errorHandler };
