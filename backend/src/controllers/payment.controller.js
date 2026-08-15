/**
 * Payment controller — pay-per-print Rp2.000 via Midtrans Snap.
 *  - POST /api/payments            → buat transaksi (201) | 409 {alreadyPaid, finalPdfUrl}
 *  - POST /api/payments/webhook    → notifikasi Midtrans (DIVERIFIKASI signature)
 *  - GET  /api/payments            → riwayat pembayaran user
 *  - GET  /api/payments/:id/status → polling ringan {status, finalPdfUrl}
 *  - GET  /api/payments/:id        → detail penuh (idempoten, milik user)
 */
const { Payment } = require('../models/payment.model');
const { CvDocument } = require('../models/cvDocument.model');
const { PlagiarismCheck } = require('../models/plagiarismCheck.model');
const { AppError } = require('../utils/AppError');
const { paymentService } = require('../services/index');

const createPayment = async (req, res) => {
  const { itemType, itemId } = req.body;
  if (!['cv', 'plagiarism'].includes(itemType)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'itemType harus "cv" atau "plagiarism"');
  }

  const { payment, alreadyPaid, finalPdfUrl } = await paymentService.createPayment(req.user, { itemType, itemId });
  if (alreadyPaid) {
    throw new AppError(409, 'ALREADY_PAID', 'Item ini sudah dibayar — PDF final sudah tersedia', {
      alreadyPaid: true,
      finalPdfUrl,
    });
  }

  res.status(201).json({
    paymentId: payment._id,
    midtransOrderId: payment.midtransOrderId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    snapToken: payment.snapToken,
    redirectUrl: payment.snapRedirectUrl,
    invoiceNumber: payment.invoiceNumber,
  });
};

const webhook = async (req, res) => {
  const { acknowledged } = await paymentService.handleWebhook(req.body);
  res.json({ status: 'ok', acknowledged });
};

const listPayments = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

  const [total, payments] = await Promise.all([
    Payment.countDocuments({ userId: req.user._id }),
    Payment.find({ userId: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ]);

  res.json({
    payments: payments.map((p) => p.toSafeJSON()),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
};

const getPayment = async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, userId: req.user._id });
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Pembayaran tidak ditemukan');
  res.json({ payment: payment.toSafeJSON() });
};

/** Polling ringan (interval 5s dari frontend): cukup status + URL PDF final.
 *  Fallback AKTIF: saat status masih 'pending', cek langsung ke Midtrans Core
 *  API (GET /v2/{order_id}/status) — webhook tetap jalur utama, tapi kalau
 *  Payment Notification URL belum terdaftar / backend di localhost, transaksi
 *  yang sudah dibayar tidak boleh menggantung selamanya. Idempoten & aman:
 *  applyTransactionStatus + finalizeItem dipakai jalur yang sama dengan webhook.
 */
const getPaymentStatus = async (req, res) => {
  let payment = await Payment.findOne({ _id: req.params.id, userId: req.user._id });
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Pembayaran tidak ditemukan');

  let source = 'db';
  if (payment.status === 'pending') {
    const { synced } = await paymentService.syncPaymentStatusFromMidtrans(payment);
    if (synced) {
      // Re-read record agar respons mencerminkan hasil sinkronisasi
      payment = await Payment.findOne({ _id: payment._id, userId: req.user._id });
      source = 'midtrans';
    }
  }

  let finalPdfUrl = null;
  if (payment.status === 'settlement') {
    const ItemModel = payment.itemType === 'cv' ? CvDocument : PlagiarismCheck;
    const item = await ItemModel.findById(payment.itemId).select('paidStatus files').lean();
    finalPdfUrl = (item && item.files && item.files.finalPdfUrl) || null;
    // Retry finalisasi bila webhook settlement sukses tapi PDF belum jadi
    if (!finalPdfUrl) {
      try {
        await paymentService.finalizeItem(payment);
        const retried = await ItemModel.findById(payment.itemId).select('files').lean();
        finalPdfUrl = (retried && retried.files && retried.files.finalPdfUrl) || null;
      } catch (err) {
        // jangan crash polling — log saja; retry berikutnya
      }
    }
  }

  res.json({
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    paidAt: payment.paidAt,
    amount: payment.amount,
    finalPdfUrl,
    source, // 'db' | 'midtrans' — dari mana status terakhir dibaca
  });
};

module.exports = { createPayment, webhook, listPayments, getPayment, getPaymentStatus };
