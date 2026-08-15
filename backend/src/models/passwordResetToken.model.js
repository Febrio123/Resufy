/**
 * PasswordResetToken — token sekali pakai, TTL index auto-expire. Koleksi: passwordResetTokens
 * Field & index persis 01-database-design.md §3.5.
 * tokenHash = hash sha256 (bukan token mentah).
 */
const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema(
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
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: { type: Date, default: null }, // one-time use tambahan di atas TTL
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// TTL index — dokumen otomatis dihapus MongoDB setelah expiresAt lewat
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
module.exports = { PasswordResetToken };
