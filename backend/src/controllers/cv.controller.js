/**
 * CV controller — CRUD CV Builder + ATS Score (gratis) + PDF download.
 * Aturan bisnis:
 *  - ATS score GRATIS (tidak ada hubungan dengan pembayaran).
 *  - UPDATE CV TANPA PEMBATASAN — semua user bisa edit kapan saja.
 *  - DELETE /api/cvs/:id = SOFT DELETE (deletedAt).
 *  - PDF: TANPA WATERMARK, gratis untuk semua user — redirect 302 ke Cloudinary.
 */
const { CvDocument } = require('../models/cvDocument.model');
const { AppError } = require('../utils/AppError');
const { logger } = require('../config/logger');
const { atsService } = require('../services/index');
const { generateCvPdf } = require('../services/pdfService');
const { uploadBuffer, getSignedUrl, publicIdFromUrl, deleteByPublicId } = require('../services/cloudinaryService');
const { escapeRegex } = require('../utils/helpers');
const { assertFileMime } = require('../utils/fileSecurity');
const sharp = require('sharp');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Helper untuk validasi magic bytes foto (JPEG/PNG)
function assertPhotoMime(buffer, declaredMime) {
  // MIME yang diizinkan untuk upload foto: image/jpeg, image/png
  const allowedMime = new Set(['image/jpeg', 'image/png']);
  if (!allowedMime.has(declaredMime)) {
    throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Foto harus JPG atau PNG');
  }
  // Magic bytes validation (JPEG = FF D8 FF, PNG = \x89PNG\r\n\x1a\n)
  assertFileMime(buffer, declaredMime);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

const createCv = async (req, res) => {
  const { title, content, template } = req.body;
  const doc = await CvDocument.create({ 
    userId: req.user._id, 
    title, 
    content,
    template: template || 'without-photo',
  });
  res.status(201).json({ cv: doc.toSafeJSON() });
};

/**
 * §35: Preview PDF STATELESS — generate PDF dari content di body, KIRIM LANGSUNG
 * sebagai stream/buffer. TIDAK menyentuh DB & TIDAK upload Cloudinary — sehingga
 * tetap berfungsi walau MongoDB mati (fitur "Buat CV Baru" preview sebelum simpan).
 * Jalur ini HANYA memakai pdfService (dependensi: pdfkit) — tidak ada query model.
 * Gratis tanpa watermark (konsisten dengan model bisnis baru).
 */
const previewPdf = async (req, res) => {
  try {
    const buffer = await generateCvPdf({ content: req.body.content || {}, template: req.body.template || 'without-photo', photoUrl: req.body.photoUrl, photoCrop: req.body.photoCrop, title: req.body.title });
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

  if (req.body.title !== undefined) doc.title = req.body.title;
  if (req.body.content !== undefined) doc.content = req.body.content;
  if (req.body.template !== undefined) doc.template = req.body.template;
  doc.files = {};
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
    template: doc.template,
    atsScore: doc.atsScore,
    atsFeedback: doc.atsFeedback,
    atsKeywordMatch: doc.atsKeywordMatch,
    // TIDAK copy foto (photoUrl, photoCrop) — user harus upload ulang
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
// PDF: Stream langsung ke browser / Adobe Acrobat (tanpa Cloudinary)
// Cloudinary HANYA digunakan untuk foto CV (cv-photos)
// ---------------------------------------------------------------------------

const getPdf = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');

  const buffer = await generateCvPdf(doc);
  const safeTitle = (doc.title || 'CV').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'CV';
  const isDownload = req.query.download === '1' || req.query.download === 'true';

  res.type('application/pdf');
  res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${safeTitle}.pdf"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(buffer);
};

// Backward compatibility - preview & final sekarang sama
const getPreviewPdf = getPdf;
const getFinalPdf = getPdf;

// ---------------------------------------------------------------------------
// Foto (template: with-photo)
// ---------------------------------------------------------------------------

/**
 * POST /api/cvs/:id/photo
 * Upload foto formal 3x4. Resize ke 240x320px (ratio 3:4), upload ke
 * Cloudinary folder `cv-photos/{cvId}`, simpan photoUrl ke CV doc.
 * Return: { photoUrl, photoCrop: {x:0, y:0, width:1, height:1} }
 */
const uploadPhoto = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');

  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Foto wajib diunggah');

  // Cek ukuran file (5MB maks) — multer udah cek, tapi double-check
  if (req.file.size && req.file.size > PHOTO_MAX_SIZE_BYTES) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'Foto maksimal 5 MB');
  }

  // Magic bytes validation (JPEG/PNG only)
  try {
    assertPhotoMime(req.file.buffer, req.file.mimetype);
  } catch (e) {
    throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Foto harus JPG atau PNG yang valid');
  }

  // Resize ke 240x320px (3:4 ratio) pakai sharp, output PNG
  const resized = await sharp(req.file.buffer)
    .resize(240, 320, { fit: 'cover' })
    .toFormat('png')
    .toBuffer();

  // Upload ke Cloudinary folder cv-photos/{cvId}
  const uploaded = await uploadBuffer(resized, {
    folder: `cv-photos/${doc._id}`,
    publicId: 'photo',
    resourceType: 'image',
    format: 'png',
  });

  doc.photoUrl = uploaded.url;
  doc.photoCrop = { x: 0, y: 0, width: 1, height: 1 };
  doc.files = {};
  await doc.save();

  res.status(200).json({ photoUrl: doc.photoUrl, photoCrop: doc.photoCrop });
};

/**
 * PUT /api/cvs/:id/photo-crop
 * Update crop coordinates (normalized 0-1 ratio).
 * Body: { photoCrop: { x, y, width, height } }
 * Return: updated CV
 */
const updatePhotoCrop = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');

  doc.photoCrop = req.body.photoCrop;
  doc.files = {};
  await doc.save();

  res.json({ cv: doc.toSafeJSON() });
};

/**
 * DELETE /api/cvs/:id/photo
 * Hapus foto: delete file Cloudinary, clear photoUrl & photoCrop.
 * Return: { success: true }
 */
const deletePhoto = async (req, res) => {
  const doc = await CvDocument.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'CV tidak ditemukan');

  if (doc.photoUrl) {
    const publicId = publicIdFromUrl(doc.photoUrl);
    if (publicId) {
      await deleteByPublicId(publicId);
    }
  }
  doc.photoUrl = null;
  doc.photoCrop = null;
  doc.files = {};
  await doc.save();

  res.json({ success: true });
};

module.exports = { createCv, previewPdf, listCvs, getCv, updateCv, deleteCv, duplicateCv, getAtsScore, getPdf, getPreviewPdf, getFinalPdf, uploadPhoto, updatePhotoCrop, deletePhoto };
