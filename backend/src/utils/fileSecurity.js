/**
 * FILE SECURITY — validasi isi file via MAGIC BYTES (bukan sekadar MIME header
 * dari client yang bisa dipalsukan). Dipanggil di controller SETELAH multer
 * memoryStorage (buffer baru tersedia di req.file.buffer).
 *
 * Pemetaan tipe yang didukung resufy:
 *   pdf   : %PDF-
 *   jpeg  : FF D8 FF
 *   png   : 89 50 4E 47 0D 0A 1A 0A
 *   webp  : RIFF .... WEBP
 *   docx  : ZIP (PK\x03\x04) — OOXML container
 *   doc   : OLE2 (D0 CF 11 E0 A1 B1 1A E1) — Word 97-2003 container
 *   txt   : tidak punya magic — diterima apa adanya (diproses sbg utf8 saja)
 *
 * Keputusan: TIDAK memakai express-mongo-sanitize / hpp (lihat 05-security.md
 * §3) — validasi input ditangani zod + query bertipe; $ di dalam konten CV
 * (mis. "salary $5000") justru sah dan tidak boleh distrip.
 */
const { AppError } = require('./AppError');

/** Deteksi tipe dari magic bytes. Return salah satu: pdf|jpeg|png|webp|zip|ole|null. */
function detectMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  const b = buffer;
  // PDF: %PDF-
  if (b.length >= 5 && b.toString('latin1', 0, 5) === '%PDF-') return 'pdf';
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'png';
  // WebP: RIFF....WEBP
  if (
    b.length >= 12 &&
    b.toString('latin1', 0, 4) === 'RIFF' &&
    b.toString('latin1', 8, 12) === 'WEBP'
  ) return 'webp';
  // ZIP (docx / xlsx / zip biasa): PK\x03\x04 | PK\x05\x06 | PK\x07\x08
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return 'zip';
  // OLE2 (doc lama): D0 CF 11 E0 A1 B1 1A E1
  if (
    b.length >= 8 &&
    b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 &&
    b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1
  ) return 'ole';
  return null;
}

// MIME yang di-klaim client -> magic yang diharapkan.
const MIME_TO_EXPECTED_MAGIC = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'zip', // .docx
  'application/msword': 'ole', // .doc
  // 'text/plain' tidak dicek (tidak punya magic) — otomatis lolos.
};

/**
 * Verifikasi isi file konsisten dengan MIME yang diklaim client.
 * Return true = aman/valid; throw AppError 415 jika magic tidak cocok.
 * @param {Buffer} buffer
 * @param {string} declaredMime
 */
function assertFileMime(buffer, declaredMime) {
  const expected = MIME_TO_EXPECTED_MAGIC[declaredMime];
  if (!expected) return true; // txt dkk — tidak ada magic untuk dicocokkan
  const detected = detectMime(buffer);
  if (detected !== expected) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      'Isi file tidak sesuai dengan tipe yang diklaim (magic bytes mismatch) — unggah ulang file yang valid'
    );
  }
  return true;
}

module.exports = { detectMime, assertFileMime, MIME_TO_EXPECTED_MAGIC };
