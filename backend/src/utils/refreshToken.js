/**
 * Refresh token helper — rotating session, refresh token JWT (revisi 2026-08-14).
 * - Token: JWT HS256 — claims sub/familyId/jti, exp mengikuti
 *   env.REFRESH_TOKEN_EXPIRES_IN (default 7d). Opaque dari sisi browser
 *   (httpOnly cookie), format JWT terpenuhi tanpa membocorkan data.
 * - Secret refresh TERPISAH (env.JWT_REFRESH_SECRET — skill jwt-authentication):
 *   refresh tidak pernah ditandatangani/diverifikasi dengan JWT_SECRET access.
 * - DB hanya menyimpan SHA-256 hash token (token mentah tidak pernah
 *   disimpan/di-log) — hash tetap dipakai untuk revoke, rotasi &
 *   reuse-detection (keluarga sesi).
 * - Cookie refresh: httpOnly, sameSite lax, secure per env, path '/api/auth'
 *   (hanya dikirim ke POST /api/auth/refresh & /api/auth/logout — middleware
 *   requireAuth TIDAK membaca cookie ini, access tetap satu-satunya).
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env, REFRESH_COOKIE_NAME, refreshCookieMaxAgeMs } = require('../config/env');

/**
 * Terbitkan JWT refresh (HS256, secret refresh terpisah). `jti` unik per token;
 * rotasi mempertahankan familyId dengan jti baru. Hash token ini (bukan
 * JWT-nya) yang disimpan di DB.
 */
function generateRefreshToken({ userId, familyId }) {
  return jwt.sign(
    { sub: String(userId), familyId, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN }
  );
}

/** Verifikasi JWT refresh (HS256) — WAJIB secret refresh, algoritma di-pin. */
function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateFamilyId() {
  return crypto.randomUUID();
}

function refreshExpiresAt() {
  return new Date(Date.now() + refreshCookieMaxAgeMs);
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.JWT_COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: refreshCookieMaxAgeMs,
    path: '/api/auth', // hanya refresh & logout (keduanya di bawah /api/auth)
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.JWT_COOKIE_SECURE,
    sameSite: 'lax',
    path: '/api/auth',
  });
}

module.exports = {
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  generateFamilyId,
  refreshExpiresAt,
  setRefreshCookie,
  clearRefreshCookie,
};
