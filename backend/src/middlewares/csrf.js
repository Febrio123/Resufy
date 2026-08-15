/**
 * CSRF PROTECTION — double-submit cookie token (fase 05, keputusan FINAL).
 *
 * Konteks: JWT httpOnly cookie dengan SameSite=Lax (DIKONFIRMASI — harus Lax,
 * bukan Strict, karena redirect balik Snap Midtrans adalah navigasi lintas
 * origin; Strict akan memutus sesi user setelah bayar). SameSite=Lax sudah
 * memblokir vektor CSRF utama (form POST & fetch lintas origin), tapi
 * defense-in-depth tetap dipasang untuk semua request MENGUBAH STATE (POST/
 * PUT/PATCH/DELETE) yang butuh auth:
 *   - Server menerbitkan token acak di cookie `resufy_csrf` (TIDAK httpOnly,
 *     supaya JS frontend bisa baca & kirim sebagai header `X-CSRF-Token`).
 *   - Middleware membandingkan header vs cookie dengan timingSafeEqual.
 *   - Tanpa kecocokan -> 403 CSRF_ERROR. (Stateless, tanpa simpanan DB.)
 *
 * Pengecualian (tidak kena CSRF, bukan ancaman sesi):
 *   - Webhook Midtrans  -> punya verifikasi signature SHA512 sendiri.
 *   - Endpoint auth publik (register/login/forgot/reset) & /csrf -> tanpa
 *     cookie sesi, CSRF tidak relevan (login-CSRF di luar scope MVP).
 *   - Toolbox (publik/anonymous) -> tanpa cookie sesi saat lintas origin
 *     (SameSite=Lax), ancaman minimal.
 */
const crypto = require('crypto');
const { AppError } = require('../utils/AppError');
const { env, CSRF_COOKIE_NAME, refreshCookieMaxAgeMs } = require('../config/env');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Terbitkan token CSRF baru di cookie (non-httpOnly). Return token. */
function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // JS frontend wajib bisa baca (double-submit)
    secure: env.JWT_COOKIE_SECURE,
    sameSite: 'lax',
    // BUG FIX 2026-08-14 (laporan user "token CSRF tidak otomatis dibuat"):
    // sebelumnya maxAge = jwtCookieMaxAgeMs (15m) → cookie CSRF expired jauh
    // sebelum sesi (refresh token 7d) → mutasi 403 CSRF_ERROR sampai refresh
    // manual browser. Umur cookie CSRF kini = umur SESI (refresh, 7d) —
    // selama sesi hidup, token selalu tersedia & valid.
    maxAge: refreshCookieMaxAgeMs,
    path: '/',
  });
  return token;
}

/** Hapus cookie CSRF (dipanggil saat logout bersamaan clearAuthCookie). */
function clearCsrfToken(res) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: env.JWT_COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Middleware CSRF — pasang SETELAH requireAuth pada route yang mengubah state.
 * Memvalidasi header `X-CSRF-Token` === cookie `resufy_csrf` (constant-time).
 */
function csrfProtect(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.get('x-csrf-token');
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string' || cookieToken.length === 0 || headerToken.length === 0) {
    return next(new AppError(403, 'CSRF_ERROR', 'Token CSRF tidak ada — muat ulang halaman atau login ulang'));
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new AppError(403, 'CSRF_ERROR', 'Token CSRF tidak cocok — muat ulang halaman atau login ulang'));
  }
  return next();
}

module.exports = { issueCsrfToken, clearCsrfToken, csrfProtect };
