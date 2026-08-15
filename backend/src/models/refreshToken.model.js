/**
 * RefreshToken — sesi refresh rotating (keputusan fase 05 revisi, 2026-08-14).
 * Koleksi: refreshtokens
 * - tokenHash: SHA-256 dari token acak (JANGAN pernah simpan token mentah).
 * - familyId: grup rotasi — semua token hasil rotasi satu login berbagi family;
 *   reuse detection mencabut SELURUH keluarga.
 * - revokedAt: non-null = tidak bisa dipakai lagi (diganti rotasi / logout / reuse).
 * - replacedByTokenHash: hash token pengganti (jejak rotasi, untuk deteksi reuse).
 * - expiresAt: TTL index (expireAfterSeconds:0) — dokumen otomatis dihapus.
 */
const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL — hapus otomatis saat kedaluwarsa
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    replacedByTokenHash: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
module.exports = { RefreshToken };
