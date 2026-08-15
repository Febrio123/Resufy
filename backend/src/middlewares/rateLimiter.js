/** Factory rate limiter (express-rate-limit). */
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

function createRateLimiter({ windowMs = env.RATE_LIMIT_WINDOW_MS, max = env.RATE_LIMIT_MAX, message, skip }) {
  return rateLimit({
    windowMs,
    limit: max, // express-rate-limit v7: `limit` menggantikan `max`
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    handler: (req, res, next, options) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: message || 'Terlalu banyak permintaan — coba lagi nanti.',
        },
      });
    },
  });
}

/** Limit ketat per endpoint sensitif. */
const strictLimits = {
  auth: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Terlalu banyak percobaan login/register. Coba lagi dalam 15 menit.' }),
  // Refresh = sinyal sesi SEHAT (bukan target brute-force) — counter TERPISAH
  // dari login/register. Sebelumnya memakai strictLimits.auth (30/15m) yang
  // SHARED dengan login → kuota habis cepat oleh boot multi-tab, retry race &
  // ensureFreshSession → 429 → login paksa tiap 15 menit (akar anomali user).
  refresh: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60, message: 'Terlalu banyak menyegarkan sesi. Coba lagi 15 menit lagi.' }),
  forgotPassword: createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, message: 'Terlalu banyak permintaan reset password. Coba lagi dalam 1 jam.' }),
  paymentCreate: createRateLimiter({ windowMs: 60 * 1000, max: 5, message: 'Terlalu banyak membuat pembayaran. Coba lagi 1 menit lagi.' }),
  upload: createRateLimiter({ windowMs: 60 * 1000, max: 5, message: 'Terlalu banyak upload. Coba lagi 1 menit lagi.' }),
  toolbox: createRateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Terlalu banyak proses Toolbox. Coba lagi 1 menit lagi.' }),
};

/**
 * Per-USER limiter untuk plagiarism upload — biaya operasional tiap cek =
 * query SerpApi berbayar (sampling ≤10). Limit per user 5 cek/jam (key =
 * userId sesi, bukan IP — mencegah abuse akun dari IP berbeda).
 * requireAuth WAJIB sudah jalan sebelum limiter ini (req.user terisi).
 * Catatan: global fallback limiter untuk /api dibuat di app.js (skip /health).
 */
const plagiarismPerUser = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Terlalu banyak pemeriksaan plagiarisme. Coba lagi 1 jam lagi.',
  keyGenerator: (req) => (req.user && req.user._id ? req.user._id.toString() : req.ip),
});

module.exports = { createRateLimiter, strictLimits, plagiarismPerUser };
