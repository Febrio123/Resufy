/**
 * Custom error class. Semua error aplikasi dilempar lewat kelas ini.
 * - `code`   : kode error string uppercase (dipakai frontend untuk branching)
 * - `extra`  : object tambahan yang di-merge ke body respons (mis. kontrak 409
 *              alreadyPaid di POST /api/payments: { alreadyPaid, finalPdfUrl })
 */
class AppError extends Error {
  constructor(statusCode, code, message, extra = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.extra = extra;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };
