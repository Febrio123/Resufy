/**
 * CV controller — CRUD CV Builder + ATS Score (gratis) + preview/final PDF.
 * Aturan bisnis:
 *  - ATS score GRATIS (tidak ada hubungan dengan pembayaran).
 *  - Update CV yang SUDAH PAID ditolak (409 LOCKED_PAID) → gunakan
 *    duplicate → hasil duplikat berstatus unpaid (keputusan lintas fase).
 *  - DELETE /api/cvs/:id = SOFT DELETE (deletedAt) — CV PAID pun tetap boleh
 *    dihapus dari riwayat (data & payment tersimpan utk audit, §34).
 *  - preview PDF: ber-watermark (gratis). final PDF: HANYA setelah bayar —
 *    guard 409 {error:{code:'NOT_PAID'}}; paid → redirect 302 ke Cloudinary.
 */
const { CvDocument } = require('../models/cvDocument.model');
const { AppError } = require('../utils/AppError');
const { logger } = require('../config/logger');
const { atsService } = require('../services/index');
const { generateCvPdf } = require('../services/pdfService');
const { uploadBuffer, getSignedUrl, publicIdFromUrl } = require('../services/cloudinaryService');
const { escapeRegex } = require('../utils/helpers');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

const createCv = async (req, res) => {
  const { title, content } = req.body;
  const doc = await CvDocument.create({ userId: req.user._id, title, content });
  res.status(201).json({ cv: doc.toSafeJSON() });
};

/**
 * §35: Preview PDF STATELESS — generate PDF dari content di body, KIRIM LANGSUNG
 * sebagai stream/buffer. TIDAK menyentuh DB & TIDAK upload Cloudinary — sehingga
 * tetap berfungsi walau MongoDB mati (fitur "Buat CV Baru" preview sebelum simpan).
 * Jalur ini HANYA memakai pdfService (dependensi: pdfkit) — tidak ada query model.
 * Always watermark:true (preview gratis ber-watermark, konsisten §32).
 */
const previewPdf = async (req, res) => {
  try {
    const buffer = await generateCvPdf({ content: req.body.content || {} }, { watermark: true });
    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview-cv.pdf"');
    res.send(buffer);
  } catch (err) {
    logger.error({ err }, '[cv] previewPdf gagal');
    throw new AppError(500, 'PDF_GENERATION_FAILED', 'Gagal membuat pratinjau PDF. Silakan coba lagi.');
  }
};

const listCvs = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || DEFAULT_PAGE);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));
  // search: cap panjang + escape regex (anti ReDoS / regex injection ke $regex)
  const search = String(req.query.search || '').trim().slice(0, 100);

  const filter = { userId: req.user._id, deletedAt: null };
  if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };

  const [total, cvs] = await Promise.all([
    CvDocument.countDocuments(filter),
    CvDocument.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ]);

  res.json({
    cvs: cvs.map((c) => c.toSafeJSON()),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
};

const getCv = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');
  res.json({ cv: doc.toSafeJSON() });
};

const updateCv = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');
  if (doc.paidStatus === 'paid') {
    throw new AppError(409, 'LOCKED_PAID', 'CV sudah dibayar & dikunci — gunakan "Duplikat CV" untuk mengubah hasil');
  }

  if (req.body.title !== undefined) doc.title = req.body.title;
  if (req.body.content !== undefined) doc.content = req.body.content;
  await doc.save();
  res.json({ cv: doc.toSafeJSON() });
};

const deleteCv = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan.');
  // §34: soft delete — CV PAID TETAP boleh dihapus (data & payment tetap
  // tersimpan utk audit; deletedAt:null-filter menyembunyikannya dari riwayat).
  // JANGAN hard-delete. Guard LOCKED_PAID utk DELETE dihapus (2026-08-14).
  doc.deletedAt = new Date();
  await doc.save();
  res.json({ message: 'CV berhasil dihapus.' });
};

const duplicateCv = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');

  const copy = new CvDocument({
    userId: req.user._id,
    title: `${doc.title || 'CV'} (Salinan)`,
    content: doc.content,
    templateId: doc.templateId,
    atsScore: doc.atsScore,
    atsFeedback: doc.atsFeedback,
    atsKeywordMatch: doc.atsKeywordMatch,
    paidStatus: 'unpaid',
  });
  await copy.save();
  res.status(201).json({ cv: copy.toSafeJSON() });
};

// ---------------------------------------------------------------------------
// ATS Score (GRATIS)
// ---------------------------------------------------------------------------

const getAtsScore = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');

  const jobDescription = req.body && req.body.jobDescription ? req.body.jobDescription : null;
  const result = atsService.analyze(doc.content || {}, jobDescription);

  // Simpan hasil analisis (tanpa JD: keywordMatch tetap null)
  doc.atsScore = result.score;
  doc.atsFeedback = result.feedback;
  doc.atsKeywordMatch = result.keywordMatch || doc.atsKeywordMatch || null;
  await doc.save();

  res.json({ score: result.score, feedback: result.feedback, keywordMatch: result.keywordMatch });
};

// ---------------------------------------------------------------------------
// PDF: preview (watermark, gratis) & final (harus paid)
// ---------------------------------------------------------------------------

const getPreviewPdf = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');

  if (!(doc.files && doc.files.previewPdfUrl)) {
    const buffer = await generateCvPdf(doc, { watermark: true });
    const uploaded = await uploadBuffer(buffer, {
      folder: `cv/${doc.userId}/${doc._id}`,
      publicId: 'preview.pdf',
      resourceType: 'raw',
      format: 'pdf',
    });
    if (!doc.files) doc.files = {};
    doc.files.previewPdfUrl = uploaded.url;
    doc.files.previewPdfPublicId = uploaded.publicId;
    await doc.save();
  }
  // Redirect ke SIGNED URL segar (akun Cloudinary bisa mengaktifkan signed URLs
  // — URL polos tersimpan hanya dipakai sbg info/fallback). publicId lama
  // diekstrak dari URL bila field baru belum terisi (dokumen sebelum migrasi).
  const publicId = doc.files.previewPdfPublicId || publicIdFromUrl(doc.files.previewPdfUrl);
  const target = getSignedUrl({ publicId, resourceType: 'raw' }) || doc.files.previewPdfUrl;
  res.redirect(302, target);
};

const getFinalPdf = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');

  if (doc.paidStatus !== 'paid') {
    throw new AppError(409, 'NOT_PAID', 'CV belum dibayar — lakukan pembayaran dulu untuk mengunduh PDF final');
  }
  if (!(doc.files && doc.files.finalPdfUrl)) {
    // Webhook settlement sukses tapi upload gagal → retry finalisasi di sini
    const buffer = await generateCvPdf(doc, { watermark: false });
    const uploaded = await uploadBuffer(buffer, {
      folder: `cv/${doc.userId}/${doc._id}`,
      publicId: `final_${Date.now()}`,
      resourceType: 'raw',
      format: 'pdf',
    });
    if (!doc.files) doc.files = {};
    doc.files.finalPdfUrl = uploaded.url;
    doc.files.finalPdfPublicId = uploaded.publicId;
    await doc.save();
  }
  const publicId = doc.files.finalPdfPublicId || publicIdFromUrl(doc.files.finalPdfUrl);
  const target = getSignedUrl({ publicId, resourceType: 'raw' }) || doc.files.finalPdfUrl;
  res.redirect(302, target);
};

module.exports = { createCv, previewPdf, listCvs, getCv, updateCv, deleteCv, duplicateCv, getAtsScore, getPreviewPdf, getFinalPdf };
