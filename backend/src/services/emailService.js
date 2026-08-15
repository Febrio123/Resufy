/**
 * Email service — reset password.
 * Keputusan kickoff: provider email TERTUNDA. User telah mengisi SMTP_* di .env,
 * jadi kita pakai nodemailer + SMTP. Jika SMTP gagal (atau belum dikonfigurasi),
 * kirim FALLBACK: link dicetak ke log (untuk develop) — respons tetap 200 (anti
 * user enumeration). TODO: verifikasi akun SMTP oleh user; opsi Resend/SendGrid
 * tetap bisa ditambahkan di sini tanpa mengubah kontrak.
 */
const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const { logger } = require('../config/logger');

const emailEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

let transporter = null;
if (emailEnabled) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // timeout agar tidak menggantung request
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

/**
 * Kirim email reset password.
 * @param {string} to email user
 * @param {string} resetLink URL lengkap ke halaman reset password frontend
 */
async function sendPasswordResetEmail(to, resetLink) {
  const from = env.EMAIL_FROM || `resufy <no-reply@${env.SMTP_HOST || 'resufy.local'}>`;
  const subject = 'resufy — Reset Password';
  const text = `Halo,\n\nKami menerima permintaan reset password untuk akunmu.\nKlik link berikut untuk mengatur password baru (berlaku 15 menit):\n\n${resetLink}\n\nJika kamu tidak meminta reset, abaikan email ini.\n\n— resufy`;

  if (!transporter) {
    // Production: JANGAN pernah mencetak reset link ke log (log bisa bocor →
    // account takeover). Dev: fallback link di log untuk memudahkan develop.
    if (env.NODE_ENV === 'production') {
      logger.error('[email] SMTP belum dikonfigurasi di production — reset password TIDAK terkirim');
      return { delivered: false };
    }
    logger.warn(`[email] SMTP belum dikonfigurasi — FALLBACK dev: reset link untuk ${to}:\n${resetLink}`);
    return { delivered: false, fallback: true };
  }

  try {
    await transporter.sendMail({ from, to, subject, text });
    logger.info({ to }, '[email] reset password email terkirim');
    return { delivered: true };
  } catch (err) {
    logger.error({ err }, `[email] gagal kirim ke ${to}`);
    if (env.NODE_ENV === 'production') {
      // Production: tanpa fallback log link (lihat catatan di atas).
      return { delivered: false };
    }
    logger.warn(`[email] FALLBACK dev reset link untuk ${to}:\n${resetLink}`);
    return { delivered: false, fallback: true };
  }
}

module.exports = { sendPasswordResetEmail, emailEnabled };
