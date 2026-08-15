/**
 * Auth middleware — JWT httpOnly cookie (Opsi A: DIKONFIRMASI fase 05).
 * Frontend TIDAK menyimpan token di localStorage; cookie dikirim otomatis.
 * req.user = DOKUMEN USER PENUH (di-fetch dari DB) — controller memakai
 * _id/email/name/toSafeJSON(). 1 query tambahan per request yang aman (Mongoose
 * query cache untuk hot path). Verify memakai algorithms eksplisit HS256.
 */
const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/AppError');
const { env, AUTH_COOKIE_NAME } = require('../config/env');
const { User } = require('../models/user.model');

function extractToken(req) {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function verifyToken(req) {
  const token = extractToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }); // { sub, iat, exp }
  } catch {
    return null;
  }
}

async function loadUser(req, required) {
  const payload = verifyToken(req);
  if (!payload || !payload.sub) {
    if (required) throw new AppError(401, 'UNAUTHORIZED', 'Anda harus login terlebih dahulu');
    return;
  }
  const user = await User.findById(payload.sub);
  if (!user) {
    if (required) throw new AppError(401, 'UNAUTHORIZED', 'Akun tidak ditemukan — silakan login ulang');
    return;
  }
  req.user = user;
}

/** Wajib login. 401 kalau token hilang/rusak/kadaluarsa/user terhapus. */
async function requireAuth(req, res, next) {
  try {
    await loadUser(req, true);
    next();
  } catch (err) {
    next(err);
  }
}

/** Opsional login: set req.user (dokumen penuh) kalau token valid, lanjut terus. */
async function optionalAuth(req, res, next) {
  try {
    await loadUser(req, false);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, optionalAuth };
