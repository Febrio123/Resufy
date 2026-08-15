/**
 * Wrapper async handler — rejected promise diteruskan ke central error handler.
 * (Express 5 sudah auto-catch async error; wrapper ini tetap dipakai eksplisit
 *  agar konsisten & aman di semua versi.)
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { catchAsync };
