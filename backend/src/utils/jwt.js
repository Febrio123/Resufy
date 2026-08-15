/**
 * JWT helper — session stateless via httpOnly cookie (keputusan fase 5: Opsi A
 * DIKONFIRMASI — SameSite=Lax + CSRF double-submit; TANPA refresh token untuk
 * MVP, lihat 05-security.md).
 * - `algorithms: ['HS256']` eksplisit (cegah confusion attack alg=none/RS*).
 * - Rotasi JWT_SECRET: dirotasi sebelum production (sekali ganti, semua sesi
 *   invalid — diterima di skala awal tanpa refresh token).
 */
const jwt = require('jsonwebtoken');
const { env, AUTH_COOKIE_NAME, jwtCookieMaxAgeMs } = require('../config/env');

function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.JWT_COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: jwtCookieMaxAgeMs,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.JWT_COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  });
}

module.exports = { signAccessToken, verifyAccessToken, setAuthCookie, clearAuthCookie };
