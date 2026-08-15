/**
 * Multer config — memoryStorage (file TIDAK disimpan permanen di server;
 * keputusan fase 4A: unggah ke Cloudinary / diproses in-memory langsung).
 * Batas default 25MB per file; whitelist tipe dokumen & gambar yang didukung.
 *
 * FACTORY: `createUpload({ maxFileSize })` — route TIDAK perlu tahu storage/
 * filter; cukup pilih batas. Export `upload` (25MB) TETAP ada (kompatibel
 * pemanggil existing) + `uploadToolbox` (50MB KHUSUS toolbox).
 */
const multer = require('multer');
const { AppError } = require('./AppError');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain', // .txt
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (naik dari 10MB — dokumen skripsi/tugas bisa >10MB;
// masih aman: Cloudinary signed upload menerima hingga 25MB di free plan)

// 50 MB KHUSUS endpoint toolbox (file compressor dll) — TIDAK dipakai route
// lain: plagiarism mengunggah ke Cloudinary (free plan 25MB), jadi batas
// global TIDAK boleh naik. Catatan RAM/performance: memoryStorage = 50MB
// input + proses re-encode (mode hard) di memori → lihat fase performance 08.
const TOOLBOX_MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * @param {{maxFileSize: number}} opts
 * @returns {import('multer').Multer} instance multer memoryStorage
 */
function createUpload({ maxFileSize }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Tipe file tidak didukung (PDF, DOCX, DOC, TXT, JPG, PNG, WebP)'));
      }
      cb(null, true);
    },
  });
}

const upload = createUpload({ maxFileSize: MAX_FILE_SIZE }); // default global (plagiarism dll)
const uploadToolbox = createUpload({ maxFileSize: TOOLBOX_MAX_FILE_SIZE }); // khusus /api/toolbox

module.exports = { upload, uploadToolbox, MAX_FILE_SIZE, TOOLBOX_MAX_FILE_SIZE, ALLOWED_MIME, createUpload };
