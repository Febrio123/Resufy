/**
 * Plagiarism controller — upload → proses ASYNC (background, polling 5s) →
 * hasil & PDF preview/final (preview gratis ber-watermark, final setelah bayar).
 * Upload WAJIB login (keputusan lintas fase: history per-user untuk model
 * pay-per-print). File asli di-upload ke Cloudinary sebagai raw.
 */
const { PlagiarismCheck } = require('../models/plagiarismCheck.model');
const { AppError } = require('../utils/AppError');
const { uploadBuffer, getSignedUrl, publicIdFromUrl, deleteByPublicId } = require('../services/cloudinaryService');
const { similarityService, pdfService } = require('../services/index');
const { generatePlagiarismPdf } = require('../services/pdfService');
const { assertFileMime } = require('../utils/fileSecurity');
const { sanitizeFilename } = require('../utils/helpers');
const { logger } = require('../config/logger');

const ALLOWED_FILE_TYPES = ['pdf', 'docx', 'doc', 'txt'];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

function mimeToFileType(mimetype) {
  const map = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
  };
  return map[mimetype] || null;
}

// ---------------------------------------------------------------------------
// Upload & list & detail
// ---------------------------------------------------------------------------

const uploadPlagiarism = async (req, res) => {
  if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'File wajib diupload (field: file)');

  const fileType = mimeToFileType(req.file.mimetype);
  if (!fileType) throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Hanya PDF, DOCX, DOC, TXT yang didukung');

  // MAGIC BYTES — MIME header dari client bisa dipalsukan; isi file dicek
  // langsung (pdf/%PDF-, docx/zip, doc/OLE). Gagal → 415, file tidak diproses.
  assertFileMime(req.file.buffer, req.file.mimetype);

  // 1) Upload file asli ke Cloudinary DULU — field uploadedFileUrl REQUIRED di
  //    model; record tidak boleh dibuat sebelum asset tersedia (BUG FIX:
  //    sebelumnya create() dipanggil tanpa url → selalu 422 VALIDATION_ERROR).
  //    Folder unik per attempt (overwrite:false) agar tidak tabrakan publicId.
  let uploaded;
  try {
    uploaded = await uploadBuffer(req.file.buffer, {
      folder: `plagiarism/${req.user._id}/${Date.now()}`,
      publicId: 'source',
      resourceType: 'raw',
      format: fileType,
    });
  } catch (err) {
    logger.warn({ err, size: req.file.size, userId: req.user._id }, '[plagiarism] upload Cloudinary gagal');
    throw new AppError(502, 'UPLOAD_FAILED', 'Dokumen gagal diunggah ke penyimpanan — coba file yang lebih kecil atau ulangi beberapa saat lagi');
  }

  // 2) Buat record (uploadedFileUrl tersedia → validasi model lolos). Kalau
  //    create/save gagal, asset Cloudinary yang sudah ter-upload di-destroy
  //    (jangan biarkan asset yatim).
  let check;
  try {
    check = await PlagiarismCheck.create({
      userId: req.user._id,
      originalFilename: sanitizeFilename(req.file.originalname, 'dokumen'), // anti CRLF/path traversal
      fileType,
      status: 'processing',
      uploadedFileUrl: uploaded.url,
    });
  } catch (err) {
    try { await deleteByPublicId(uploaded.publicId); } catch { /* cleanup best-effort */ }
    throw err;
  }

  // Proses background (fire-and-forget); frontend polling GET /api/plagiarism/:id
  similarityService.enqueueCheck(check._id);

  res.status(202).json({
    checkId: check._id,
    status: check.status,
    message: 'Pemeriksaan sedang berjalan — polling status setiap 5 detik',
  });
};

const listChecks = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || DEFAULT_PAGE);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));

  const filter = { userId: req.user._id, deletedAt: null };
  // OPTIMASI FASE 08: list hanya butuh field ringan (lihat DashboardPage — yang
  // dipakai: _id, originalFilename, createdAt, fileType, status, overallScore).
  // Field berat (segments+sources+localSources+errorMessage) tidak dikirim →
  // payload list turun drastis (sebelumnya s.d. ~100KB per check yang completed).
  const [total, checks] = await Promise.all([
    PlagiarismCheck.countDocuments(filter),
    PlagiarismCheck.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-segments -sources -localSources -errorMessage'),
  ]);

  res.json({
    checks: checks.map((c) => c.toSafeJSON()),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
};

const getCheck = async (req, res) => {
  const check = await PlagiarismCheck.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!check) throw new AppError(404, 'NOT_FOUND', 'Pemeriksaan tidak ditemukan');
  res.json({ check: check.toSafeJSON() });
};

// ---------------------------------------------------------------------------
// PDF preview (watermark) & final (harus paid)
// ---------------------------------------------------------------------------

const getPreviewPdf = async (req, res) => {
  const check = await PlagiarismCheck.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!check) throw new AppError(404, 'NOT_FOUND', 'Pemeriksaan tidak ditemukan');
  if (check.status !== 'completed') {
    throw new AppError(409, 'CHECK_NOT_READY', 'Pemeriksaan belum selesai — tunggu status completed');
  }

  if (!(check.files && check.files.previewPdfUrl)) {
    const buffer = await generatePlagiarismPdf(check, { watermark: true });
    const uploaded = await uploadBuffer(buffer, {
      folder: `plagiarism/${check.userId}/${check._id}`,
      publicId: 'preview.pdf',
      resourceType: 'raw',
      format: 'pdf',
    });
    if (!check.files) check.files = {};
    check.files.previewPdfUrl = uploaded.url;
    check.files.previewPdfPublicId = uploaded.publicId;
    await check.save();
  }
  const publicId = check.files.previewPdfPublicId || publicIdFromUrl(check.files.previewPdfUrl);
  const target = getSignedUrl({ publicId, resourceType: 'raw' }) || check.files.previewPdfUrl;
  res.redirect(302, target);
};

const getFinalPdf = async (req, res) => {
  const check = await PlagiarismCheck.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!check) throw new AppError(404, 'NOT_FOUND', 'Pemeriksaan tidak ditemukan');
  if (check.status !== 'completed') {
    throw new AppError(409, 'CHECK_NOT_READY', 'Pemeriksaan belum selesai');
  }
  if (check.paidStatus !== 'paid') {
    throw new AppError(409, 'NOT_PAID', 'Laporan belum dibayar — lakukan pembayaran untuk mengunduh PDF final');
  }

  if (!(check.files && check.files.finalPdfUrl)) {
    const buffer = await generatePlagiarismPdf(check, { watermark: false });
    const uploaded = await uploadBuffer(buffer, {
      folder: `plagiarism/${check.userId}/${check._id}`,
      publicId: `final_${Date.now()}`,
      resourceType: 'raw',
      format: 'pdf',
    });
    if (!check.files) check.files = {};
    check.files.finalPdfUrl = uploaded.url;
    check.files.finalPdfPublicId = uploaded.publicId;
    await check.save();
  }
  const publicId = check.files.finalPdfPublicId || publicIdFromUrl(check.files.finalPdfUrl);
  const target = getSignedUrl({ publicId, resourceType: 'raw' }) || check.files.finalPdfUrl;
  res.redirect(302, target);
};

module.exports = { uploadPlagiarism, listChecks, getCheck, getPreviewPdf, getFinalPdf, mimeToFileType };
