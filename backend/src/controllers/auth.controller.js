/**
 * Auth controller — register/login/logout/me/forgot-password/reset-password.
 * Session: JWT httpOnly cookie (`resufy_token`) + CSRF double-submit cookie
 * (`resufy_csrf`, non-httpOnly). Login rate-limited ketat.
 * Anti-enumeration: login & forgot-password pakai pesan seragam (tidak
 * membocorkan keberadaan email); register tetap 409 EMAIL_TAKEN (UX standar).
 */
const { User } = require('../models/user.model');
const { PasswordResetToken } = require('../models/passwordResetToken.model');
const { RefreshToken } = require('../models/refreshToken.model');
const { AppError } = require('../utils/AppError');
const { generateRandomToken, hashToken } = require('../utils/helpers');
const { signAccessToken, setAuthCookie, clearAuthCookie } = require('../utils/jwt');
const {
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  generateFamilyId,
  refreshExpiresAt,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/refreshToken');
const { issueCsrfToken, clearCsrfToken } = require('../middlewares/csrf');
const { sendPasswordResetEmail } = require('../services/emailService');
const { env, REFRESH_COOKIE_NAME } = require('../config/env');
const { logger } = require('../config/logger');

/**
 * GRACE PERIOD reuse detection (fix multi-tab, 2026-08-14):
 * Dua tab browser berbagi cookie jar → saat access expired, keduanya boot dan
 * memanggil POST /api/auth/refresh dengan token yang SAMA. Tab yang menang
 * merotasi (token lama di-revoke), tab yang kalah menemukan token sudah
 * revoked beberapa milidetik lalu — ini RACE antar tab sendiri, BUKAN
 * pencurian token. Tanpa grace, tab kalah dihukum SESSION_REUSED (atau lebih
 * parah: keluarga dicabut → SEMUA tab logout).
 * Token hasil ROTASI punya jejak `replacedByTokenHash`; jika revoked terjadi
 * < REUSE_GRACE_MS yang lalu → perlakukan sebagai race (401 netral, keluarga
 * SELAMAT). Reuse di luar grace / token hasil LOGOUT (tanpa replacedBy)
 * tetap reuse asli → cabut keluarga.
 */
const REUSE_GRACE_MS = 45_000;

/** Terbitkan JWT refresh baru + simpan hash di DB + set cookie. Dipakai register/login. */
async function issueRefreshSession(res, userId) {
  const familyId = generateFamilyId();
  const refreshToken = generateRefreshToken({ userId, familyId });
  await RefreshToken.create({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    familyId,
    expiresAt: refreshExpiresAt(),
  });
  setRefreshCookie(res, refreshToken);
  return refreshToken;
}

/**
 * POST /api/auth/refresh — ROTASI atomik + reuse detection dengan grace period.
 * 0) JWT refresh diverifikasi (HS256). Gagal → 401 UNAUTHORIZED biasa.
 * 1) Token dari cookie di-claim atomik (findOneAndUpdate kondisi revokedAt:null).
 * 2) Sudah revoked:
 *    - Jejak rotasi (replacedByTokenHash ada) & usia revoked < REUSE_GRACE_MS
 *      → RACE antar tab → 401 UNAUTHORIZED netral, keluarga TIDAK dicabut.
 *    - Selain itu → REUSE asli → cabut SELURUH keluarga → 401 SESSION_REUSED.
 * 3) Kalah claim atomik (claimed null) → token baru saja dirotasi ms lalu oleh
 *    tab lain → SELALU race → 401 UNAUTHORIZED netral (JANGAN cabut keluarga).
 * 4) Berhasil claim → terbitkan access+refresh baru; refresh lama ditandai
 *    revoked + replacedByTokenHash (jejak rotasi).
 * Semua penolakan di-log dengan alasan spesifik (tanpa token/hash penuh).
 */
const refreshSession = async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!raw || raw.length < 40) {
    logger.warn({}, '[auth] refresh ditolak: NO_COOKIE (cookie refresh tidak ada/terlalu pendek)');
    throw new AppError(401, 'UNAUTHORIZED', 'Sesi berakhir — silakan masuk kembali');
  }
  const tokenHash = hashRefreshToken(raw);

  // 0) Verifikasi JWT refresh (HS256, secret refresh TERPISAH): tanda tangan,
  //    klaim, exp. Gagal di sini (token kedaluwarsa 7d / dirusak / bukan JWT)
  //    → 401 UNAUTHORIZED biasa, BUKAN SESSION_REUSED — ini JWT invalid,
  //    bukan reuse terdeteksi.
  let decoded;
  try {
    decoded = verifyRefreshToken(raw);
  } catch (err) {
    const reason = err.name === 'TokenExpiredError' ? 'JWT_EXPIRED' : 'JWT_INVALID';
    logger.warn({ reason, errorName: err.name }, '[auth] refresh ditolak: verifikasi JWT gagal');
    throw new AppError(401, 'UNAUTHORIZED', 'Sesi kedaluwarsa — silakan masuk kembali');
  }

  const record = await RefreshToken.findOne({ tokenHash }).lean();
  if (!record) {
    logger.warn({}, '[auth] refresh ditolak: TOKEN_NOT_FOUND');
    throw new AppError(401, 'UNAUTHORIZED', 'Sesi tidak valid — silakan masuk kembali');
  }
  // JWT harus konsisten dengan record DB (sub + familyId) — mencegah JWT sah
  // dengan klaim yang dimodifikasi / mismatch antar session.
  if (String(record.userId) !== String(decoded.sub) || record.familyId !== decoded.familyId) {
    logger.warn({ userId: record.userId }, '[auth] refresh ditolak: FAMILY_MISMATCH (JWT vs DB)');
    throw new AppError(401, 'UNAUTHORIZED', 'Sesi tidak valid — silakan masuk kembali');
  }
  if (record.expiresAt < new Date()) {
    logger.warn({ userId: record.userId }, '[auth] refresh ditolak: EXPIRED');
    throw new AppError(401, 'UNAUTHORIZED', 'Sesi kedaluwarsa — silakan masuk kembali');
  }

  if (record.revokedAt) {
    const revokedAgeMs = Date.now() - new Date(record.revokedAt).getTime();
    const hasRotationTrace = Boolean(record.replacedByTokenHash);
    if (hasRotationTrace && revokedAgeMs < REUSE_GRACE_MS) {
      // RACE antar tab: token lama baru saja dirotasi tab lain (ms/detik lalu).
      // Keluarga SELAMAT — frontend retry otomatis dengan cookie terbaru.
      logger.warn({ userId: record.userId, revokedAgeMs }, '[auth] refresh ditolak: REVOKED_RACE (grace period)');
      throw new AppError(401, 'UNAUTHORIZED', 'Sesi berakhir — muat ulang halaman');
    }
    // REUSE asli: dipakai lagi setelah grace (token bekas rotasi) ATAU token
    // hasil logout dipakai lagi (replacedByTokenHash null). Cabut keluarga.
    await RefreshToken.updateMany(
      { familyId: record.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    logger.warn(
      { userId: record.userId, revokedAgeMs, reason: hasRotationTrace ? 'REVOKED_REUSE' : 'REVOKED_LOGOUT' },
      '[auth] reuse refresh token terdeteksi — keluarga sesi dicabut'
    );
    throw new AppError(401, 'SESSION_REUSED', 'Sesi ini sudah digunakan di perangkat lain — silakan masuk kembali');
  }

  // Claim atomik (anti race): hanya satu request yang berhasil menandai revoked.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    // Kalah race: token baru saja di-claim (dirotasi) oleh tab/request lain
    // dalam hitungan ms — ini SELALU race antar tab sendiri, bukan pencurian.
    // Keluarga TIDAK dicabut; 401 netral agar frontend retry cookie terbaru.
    logger.warn({ userId: record.userId }, '[auth] refresh ditolak: RACE_LOST (token baru saja dirotasi)');
    throw new AppError(401, 'UNAUTHORIZED', 'Sesi berakhir — muat ulang halaman');
  }

  const user = await User.findById(claimed.userId);
  if (!user) {
    logger.warn({ userId: claimed.userId }, '[auth] refresh ditolak: USER_NOT_FOUND');
    throw new AppError(401, 'UNAUTHORIZED', 'Akun tidak ditemukan');
  }

  const accessToken = signAccessToken(user._id);
  const newRefresh = generateRefreshToken({ userId: user._id, familyId: record.familyId });
  const newHash = hashRefreshToken(newRefresh);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: newHash,
    familyId: record.familyId, // tetap satu keluarga (rotasi)
    expiresAt: refreshExpiresAt(),
  });
  await RefreshToken.updateOne({ _id: claimed._id }, { $set: { replacedByTokenHash: newHash } });

  setAuthCookie(res, accessToken);
  setRefreshCookie(res, newRefresh);
  res.json({ user: user.toSafeJSON() });
};

const register = async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar — silakan login');

  const user = await User.create({ name, email, passwordHash: password }); // pre-save hook hash otomatis
  const token = signAccessToken(user._id);
  setAuthCookie(res, token);
  await issueRefreshSession(res, user._id);
  const csrfToken = issueCsrfToken(res);

  res.status(201).json({ user: user.toSafeJSON(), token, csrfToken });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findByEmailWithPassword(email);
  const ok = user && (await user.comparePassword(password));
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');

  const token = signAccessToken(user._id);
  setAuthCookie(res, token);
  await issueRefreshSession(res, user._id);
  const csrfToken = issueCsrfToken(res);
  res.json({ user: user.toSafeJSON(), token, csrfToken });
};

const logout = async (req, res) => {
  clearAuthCookie(res);
  clearCsrfToken(res);
  // Revoke keluarga refresh session (kalau cookie refresh terkirim).
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (raw) {
    const rec = await RefreshToken.findOne({ tokenHash: hashRefreshToken(raw) });
    if (rec) {
      await RefreshToken.updateMany({ familyId: rec.familyId }, { $set: { revokedAt: new Date() } });
    }
  }
  clearRefreshCookie(res);
  res.json({ message: 'Berhasil logout' });
};

const me = async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
};

/** Terbitkan token CSRF baru (cookie) — dipanggil frontend saat boot/reload. */
const getCsrf = async (req, res) => {
  const csrfToken = issueCsrfToken(res);
  res.json({ csrfToken });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Selalu 200 — tidak membocorkan apakah email terdaftar
  if (user) {
    const token = generateRandomToken();
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 menit
    });
    const resetLink = `${env.CLIENT_ORIGIN}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendPasswordResetEmail(user.email, resetLink);
    logger.info({ userId: user._id }, '[auth] forgot-password: token dibuat & dikirim');
  }
  res.json({ message: 'Jika email terdaftar, link reset sudah dikirim' });
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError(400, 'VALIDATION_ERROR', 'token dan password wajib diisi');
  if (password.length < 8) throw new AppError(400, 'VALIDATION_ERROR', 'Password minimal 8 karakter');

  const record = await PasswordResetToken.findOne({ tokenHash: hashToken(token) });
  if (!record) throw new AppError(400, 'INVALID_TOKEN', 'Token tidak valid');
  if (record.usedAt) throw new AppError(400, 'INVALID_TOKEN', 'Token sudah digunakan');
  if (record.expiresAt < new Date()) throw new AppError(400, 'TOKEN_EXPIRED', 'Token sudah kedaluwarsa');

  const user = await User.findById(record.userId);
  if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Token tidak valid');

  user.passwordHash = password; // pre-save hook hash otomatis (field schema: passwordHash)
  await user.save();
  record.usedAt = new Date();
  await record.save();

  // Invalidasi token reset lain milik user (sudah terpakai)
  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null },
    { usedAt: new Date() }
  );

  clearAuthCookie(res);
  res.json({ message: 'Password berhasil direset — silakan login' });
};

module.exports = { register, login, logout, me, getCsrf, forgotPassword, resetPassword, refreshSession };
