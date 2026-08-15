/**
 * Payment service — Midtrans (Snap), model bisnis pay-per-print Rp2.000/unduhan.
 * Flow (UML 02 §4.2 Payment): create → Snap token → user bayar di halaman Midtrans
 * → webhook settlement → finalisasi (generate + upload PDF final → update paidStatus).
 *
 * PENTING (security):
 *  - Signature webhook diverifikasi sha512(order_id + status_code + gross_amount + serverKey)
 *  - Idempotensi: webhook berulang tidak menggandakan finalisasi (guard status/paidStatus).
 *  - Owner check: user hanya bisa membayar item miliknya sendiri.
 */
const crypto = require('crypto');
const midtransClient = require('midtrans-client');
const { Payment } = require('../models/payment.model');
const { CvDocument } = require('../models/cvDocument.model');
const { PlagiarismCheck } = require('../models/plagiarismCheck.model');
const { env, PRICE_AMOUNT_IDR } = require('../config/env');
const { logger } = require('../config/logger');
const { AppError } = require('../utils/AppError');
const { generateMidtransOrderId, generateInvoiceNumber } = require('../utils/helpers');
const { generateCvPdf, generatePlagiarismPdf } = require('./pdfService');
const { uploadBuffer } = require('./cloudinaryService');

const snap = new midtransClient.Snap({
  isProduction: env.MIDTRANS_IS_PRODUCTION,
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.MIDTRANS_CLIENT_KEY,
});
// Override base URL ke sandbox Midtrans dari env (SDK kadang masih menunjuk prod)
if (env.MIDTRANS_SNAP_BASE_URL) {
  try {
    snap.apiConfig.snapBaseUrl = env.MIDTRANS_SNAP_BASE_URL;
  } catch (err) {
    logger.warn('[payment] gagal override snapBaseUrl, pakai default SDK');
  }
}

// ============================================================================
// Helper item lookup + ownership
// ============================================================================

async function findOwnedItem(itemType, itemId, userId) {
  if (itemType === 'cv') {
    const doc = await CvDocument.findOne({ _id: itemId, userId, deletedAt: null });
    return { type: 'cv', doc };
  }
  if (itemType === 'plagiarism') {
    const doc = await PlagiarismCheck.findOne({ _id: itemId, userId, deletedAt: null });
    return { type: 'plagiarism', doc };
  }
  return { type: itemType, doc: null };
}

// ============================================================================
// 1. Buat pembayaran
// ============================================================================

/**
 * @returns {Promise<{payment: Payment, alreadyPaid: boolean, finalPdfUrl?: string|null}>}
 */
async function createPayment(user, { itemType, itemId }) {
  const { type, doc } = await findOwnedItem(itemType, itemId, user._id);
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'Item tidak ditemukan atau bukan milikmu');

  // Sudah pernah bayar? Return penanda agar controller balas 409 {alreadyPaid, finalPdfUrl}
  if (doc.paidStatus === 'paid') {
    return { payment: null, alreadyPaid: true, finalPdfUrl: (doc.files && doc.files.finalPdfUrl) || null };
  }

  const amount = PRICE_AMOUNT_IDR; // Rp2.000 (keputusan final requirement)
  const midtransOrderId = generateMidtransOrderId();

  const payment = new Payment({
    userId: user._id,
    itemType: type,
    itemId: doc._id,
    amount,
    currency: 'IDR',
    midtransOrderId,
    invoiceNumber: generateInvoiceNumber(),
    status: 'pending',
  });

  try {
    // customer_details yang valid membantu skor trust Midtrans:
    // first_name pakai nama riil; fallback ke bagian lokal email jika kosong.
    const firstName = (user.name || '').trim() || String(user.email || '').split('@')[0] || 'Pengguna resufy';
    const result = await snap.createTransaction({
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: firstName,
        email: user.email,
      },
      item_details: [
        { id: `${type}:${itemId}`, price: amount, quantity: 1, name: itemType === 'cv' ? 'Unduh PDF Final CV' : 'Unduh PDF Final Laporan Plagiarisme' },
      ],
    });
    payment.snapToken = result.token || null;
    payment.snapRedirectUrl = result.redirect_url || null;
    await payment.save();
    return { payment, alreadyPaid: false };
  } catch (err) {
    logger.error({ err }, '[payment] Midtrans createTransaction gagal');
    // Petakan error sisi Midtrans yang umum ke pesan ramah (JANGAN bocorkan
    // pesan mentah provider ke frontend). "untrusted" = banyak percobaan gagal
    // dari identitas yang sama → panduan tunggu/ulang.
    const apiResp = err.ApiResponse || {};
    const raw = `${err.message || ''} ${JSON.stringify(apiResp)}`;
    if (/untrusted|show_original_customer_untrusted/i.test(raw)) {
      throw new AppError(
        402,
        'PAYMENT_CUSTOMER_UNTRUSTED',
        'Midtrans menolak pembayaran: terlalu banyak percobaan gagal dari identitas ini. Tunggu 10–30 menit, atau coba dengan kartu uji yang benar (4811 1111 1111 1114, contoh expiry 01/28, CVV 123), lalu ulangi.'
      );
    }
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Gagal membuat pembayaran — coba lagi');
  }
}

// ============================================================================
// 2. Webhook Midtrans
// ============================================================================

function verifyWebhookSignature(payload) {
  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signatureKey } = payload || {};
  // Type check ketat: orderId harus string; statusCode & grossAmount boleh
  // string ATAU number (Midtrans kadang kirim numerik) — keduanya di-String()
  // persis seperti nilai yang ditandatangani Midtrans.
  if (typeof orderId !== 'string' || orderId.length === 0) return false;
  if (!['string', 'number'].includes(typeof statusCode)) return false;
  if (!['string', 'number'].includes(typeof grossAmount)) return false;
  if (typeof signatureKey !== 'string' || signatureKey.length === 0) return false;
  const expected = crypto
    .createHash('sha512')
    .update(`${orderId}${String(statusCode)}${String(grossAmount)}${env.MIDTRANS_SERVER_KEY}`)
    .digest();
  const received = Buffer.from(signatureKey, 'hex');
  // timingSafeEqual butuh panjang SAMA — tolak dulu kalau beda (cek kecepatan konstan)
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

function mapTransactionStatus(payload) {
  const ts = payload.transaction_status;
  const fs = payload.fraud_status;
  if (ts === 'capture') return fs === 'accept' ? 'settlement' : 'pending'; // challenge → pending
  if (ts === 'settlement') return 'settlement';
  if (ts === 'pending') return 'pending';
  if (ts === 'expire') return 'expire';
  if (ts === 'deny' || ts === 'cancel') return 'cancel';
  return null; // refund dkk → null (tidak mengubah status MVP)
}

/** Sanitasi payload webhook sebelum disimpan (whitelist field). */
function sanitizeWebhookPayload(payload) {
  const pick = ['order_id', 'transaction_id', 'transaction_status', 'transaction_time', 'payment_type', 'fraud_status', 'gross_amount', 'status_code', 'signature_key', 'settlement_time', 'expiry_time'];
  const out = {};
  for (const k of pick) if (payload[k] !== undefined) out[k] = payload[k];
  return out;
}

/**
 * Terapkan status transaksi hasil verifikasi ke record payment + finalisasi.
 * SATU-SATUNYA jalur update-status (source of truth) — dipakai oleh:
 *  1) handleWebhook   (payload diverifikasi signature + payment sudah di-lookup)
 *  2) syncPaymentStatusFromMidtrans (fallback polling — payload dari API status)
 * Idempoten: status sama → tidak ada perubahan; settlement → finalizeItem
 * (finalizeItem sendiri idempoten).
 * @param {Payment} payment
 * @param {object} payload — minimal: gross_amount, transaction_status, fraud_status
 * @returns {Promise<{acknowledged: boolean, statusChanged: boolean}>}
 */
async function applyTransactionStatus(payment, payload) {
  // Konsistensi amount & currency vs record DB (defense-in-depth; untuk webhook
  // ini lapisan kedua DI ATAS signature, untuk fallback sumbernya API resmi).
  const grossNum = Number(payload.gross_amount);
  if (!Number.isFinite(grossNum) || grossNum !== payment.amount) {
    logger.warn(
      { orderId: payment.midtransOrderId, expected: payment.amount, received: payload.gross_amount },
      '[payment] gross_amount tidak cocok dengan record — status tidak diubah'
    );
    return { acknowledged: true, statusChanged: false };
  }
  if (payload.currency && payload.currency !== payment.currency) {
    logger.warn(
      { orderId: payment.midtransOrderId, expected: payment.currency, received: payload.currency },
      '[payment] currency tidak cocok dengan record — status tidak diubah'
    );
    return { acknowledged: true, statusChanged: false };
  }

  const newStatus = mapTransactionStatus(payload);
  if (!newStatus || newStatus === payment.status) {
    return { acknowledged: true, statusChanged: false }; // idempoten / status tidak berubah
  }

  payment.status = newStatus;
  payment.midtransTransactionId = payload.transaction_id || payment.midtransTransactionId;
  payment.paymentMethod = payload.payment_type || payment.paymentMethod;
  if (newStatus === 'settlement') {
    payment.paidAt = payload.settlement_time ? new Date(payload.settlement_time) : new Date();
    if (!payment.invoiceNumber) payment.invoiceNumber = generateInvoiceNumber();
  }
  payment.lastWebhookPayload = sanitizeWebhookPayload(payload);
  await payment.save();
  logger.info({ orderId: payment.midtransOrderId, status: newStatus }, '[payment] status transaksi diperbarui');

  // Finalisasi: hanya saat transisi → settlement
  if (newStatus === 'settlement') {
    await finalizeItem(payment);
  }
  return { acknowledged: true, statusChanged: true };
}

/**
 * Proses webhook. Idempoten — aman dipanggil berulang.
 * @returns {Promise<{acknowledged: boolean, statusChanged: boolean}>}
 */
async function handleWebhook(payload) {
  if (!verifyWebhookSignature(payload)) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Signature webhook tidak valid');
  }

  const payment = await Payment.findOne({ midtransOrderId: payload.order_id });
  if (!payment) {
    // Order tidak dikenal: ack 200 (jangan membocorkan status), hanya log.
    logger.warn({ orderId: payload.order_id }, '[payment] webhook utk order tidak dikenal — diabaikan');
    return { acknowledged: true, statusChanged: false };
  }

  return applyTransactionStatus(payment, payload);
}

// ============================================================================
// 2b. FALLBACK: status check langsung ke Midtrans (polling aktif)
// ============================================================================

/**
 * Cek status transaksi langsung ke Midtrans Core API (GET /v2/{order_id}/status)
 * dan, bila berubah, terapkan via applyTransactionStatus (jalur SAMA dengan
 * webhook). Dipakai polling GET /api/payments/:id/status ketika webhook belum
 * masuk (URL webhook belum terdaftar di dashboard, atau backend di localhost
 * tidak terjangkau Midtrans).
 *
 * Keamanan: dipanggil hanya untuk payment milik user terautentikasi (lookup
 * userId dilakukan controller). TIDAK melempar error jaringan — polling lanjut
 * di tick berikutnya.
 *
 * @param {Payment} payment — dokumen mongoose payment
 * @returns {Promise<{synced: boolean, statusChanged: boolean}>}
 */
async function syncPaymentStatusFromMidtrans(payment) {
  let statusResp;
  try {
    statusResp = await snap.transaction.status(payment.midtransOrderId);
  } catch (err) {
    // 404/407 = order tidak dikenal/expired di Midtrans; 5xx/timeout = gangguan
    // provider. Keduanya TIDAK boleh menggagalkan polling — biarkan pending.
    logger.warn(
      { orderId: payment.midtransOrderId, http: err.httpStatusCode ?? err.http_code ?? '?' },
      '[payment] fallback status check gagal — biarkan pending, coba lagi nanti'
    );
    return { synced: false, statusChanged: false };
  }

  if (!statusResp || !statusResp.transaction_status) {
    logger.warn({ orderId: payment.midtransOrderId }, '[payment] fallback status check: respons tanpa transaction_status');
    return { synced: false, statusChanged: false };
  }

  // Bentuk payload minimal yang SETARA dengan webhook (signature_key tidak
  // ada di API status — tidak diperlukan karena jalur applyTransactionStatus
  // tidak memverifikasi signature; pemanggil sudah memastikan kepemilikan).
  const payload = {
    order_id: statusResp.order_id || payment.midtransOrderId,
    status_code: statusResp.status_code || '200',
    transaction_status: statusResp.transaction_status,
    fraud_status: statusResp.fraud_status,
    gross_amount: statusResp.gross_amount ?? payment.amount,
    transaction_id: statusResp.transaction_id,
    payment_type: statusResp.payment_type,
    transaction_time: statusResp.transaction_time,
    settlement_time: statusResp.settlement_time,
    expiry_time: statusResp.expiry_time,
  };

  try {
    const { statusChanged } = await applyTransactionStatus(payment, payload);
    return { synced: true, statusChanged };
  } catch (err) {
    // Finalisasi bisa gagal (mis. Cloudinary) — jangan crash polling; retry
    // berikutnya (settlement tetap tersimpan, finalizeItem idempoten).
    logger.error({ err, orderId: payment.midtransOrderId }, '[payment] fallback apply status gagal');
    return { synced: true, statusChanged: false };
  }
}

// ============================================================================
// 3. Finalisasi — generate + upload PDF FINAL (tanpa watermark), update item
// ============================================================================

async function uploadItemPdf(itemType, item, userId, buffer) {
  const folder = `payment/${itemType}/${item._id}`;
  const publicId = `final_${Date.now()}`;
  return uploadBuffer(buffer, { folder, publicId, resourceType: 'raw', format: 'pdf' });
}

async function finalizeItem(payment) {
  const { type, doc } = await findOwnedItem(payment.itemType, payment.itemId, payment.userId);
  if (!doc) {
    logger.warn({ paymentId: payment._id }, '[payment] finalisasi gagal — item tidak ditemukan');
    return;
  }
  // Idempoten: sudah paid & PDF final ada → tidak generate ulang.
  if (doc.paidStatus === 'paid' && doc.files && doc.files.finalPdfUrl) return;

  const watermark = false;
  const buffer = type === 'cv'
    ? await generateCvPdf(doc, { watermark })
    : await generatePlagiarismPdf(doc, { watermark });

  const uploaded = await uploadItemPdf(type, doc, payment.userId, buffer);

  const ItemModel = type === 'cv' ? CvDocument : PlagiarismCheck;
  // Claim transisi ATOMIK (anti race double-finalize saat dua webhook
  // settlement tiba bersamaan): hanya satu penulis yang berhasil mengubah
  // paidStatus unpaid→paid; yang kalah membuang hasil upload (log saja).
  // Kasus retry (paid tapi URL belum tersimpan) → update URL saja.
  const updated = doc.paidStatus === 'unpaid'
    ? await ItemModel.findOneAndUpdate(
        { _id: doc._id, paidStatus: 'unpaid' },
        { $set: { paidStatus: 'paid', paidAt: new Date(), 'files.finalPdfUrl': uploaded.url, 'files.finalPdfPublicId': uploaded.publicId } },
        { new: true }
      )
    : await ItemModel.findOneAndUpdate(
        { _id: doc._id, paidStatus: 'paid' },
        { $set: { 'files.finalPdfUrl': uploaded.url, 'files.finalPdfPublicId': uploaded.publicId } },
        { new: true }
      );

  if (!updated) {
    logger.warn({ itemType: type, itemId: doc._id }, '[payment] finalisasi: item sudah diproses webhook lain (race) — upload dibuang');
    return;
  }
  logger.info({ itemType: type, itemId: doc._id, paymentId: payment._id }, '[payment] item difinalisasi (PDF final siap)');
}

module.exports = {
  createPayment,
  handleWebhook,
  applyTransactionStatus,
  syncPaymentStatusFromMidtrans,
  verifyWebhookSignature,
  mapTransactionStatus,
  sanitizeWebhookPayload,
  finalizeItem,
  findOwnedItem,
  snap,
};
