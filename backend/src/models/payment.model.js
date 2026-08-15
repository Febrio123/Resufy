/**
 * Payment — SATU koleksi utk transaksi kedua modul berbayar (pay-per-print Rp2.000).
 * Koleksi: payments. Field & index persis 01-database-design.md §3.4.
 * Relasi polymorphic: itemType ('cv'|'plagiarism') + itemId (ObjectId dokumen target).
 * midtransOrderId UNIQUE — kunci idempotensi webhook.
 */
const mongoose = require('mongoose');
const { PRICE_AMOUNT_IDR } = require('../config/env');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId wajib'],
      index: true,
    },
    itemType: {
      type: String,
      enum: ['cv', 'plagiarism'],
      required: [true, 'itemType wajib (cv | plagiarism)'],
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'itemId wajib'],
      // Polymorphic ref — integritas divalidasi di lapisan aplikasi (anti-IDOR)
    },
    amount: { type: Number, required: true, default: PRICE_AMOUNT_IDR }, // integer IDR
    currency: { type: String, required: true, default: 'IDR' },
    midtransOrderId: {
      type: String,
      required: true,
      unique: true, // UNIQUE index — idempotensi webhook
      trim: true,
    },
    midtransTransactionId: { type: String, default: null },
    snapToken: { type: String, default: null },
    snapRedirectUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'settlement', 'expire', 'cancel'],
      default: 'pending', // 'created' adalah state transien konseptual — tidak disimpan
    },
    paymentMethod: { type: String, default: null }, // qris, bank_transfer, gopay, shopeepay, dll
    invoiceNumber: { type: String, default: null },
    lastWebhookPayload: { type: mongoose.Schema.Types.Mixed, default: null }, // sanitasi sebelum simpan
    paidAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.lastWebhookPayload;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index sesuai desain
paymentSchema.index({ userId: 1, createdAt: -1 }); // riwayat transaksi dashboard
paymentSchema.index({ status: 1, createdAt: 1 }); // cron/sync pending yang expire
paymentSchema.index({ itemType: 1, itemId: 1, status: 1 }); // validasi "sudah pernah settlement?"

paymentSchema.methods.isSettled = function isSettled() {
  return this.status === 'settlement';
};

paymentSchema.methods.toSafeJSON = function toSafeJSON() {
  return this.toJSON();
};

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = { Payment };
