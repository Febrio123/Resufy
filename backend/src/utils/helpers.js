/** Helper umum: id generator, token hash, sanitasi teks, tokenisasi keyword. */
const crypto = require('crypto');

/** Order ID unik utk Midtrans: ORDER-<epoch>-<random4> (unique index di payments). */
function generateMidtransOrderId() {
  return `ORDER-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

/** Invoice sederhana: RSF-YYYYMM-XXXX (fallback kontrak UI: pakai midtransOrderId). */
function generateInvoiceNumber() {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `RSF-${yyyymm}-${rand}`;
}

/** Hash token reset password (tokenHash — jangan simpan token mentah). */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Token acak utk reset password (hex, 32 byte). */
function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Sanitasi teks dasar: normalisasi whitespace, buang karakter kontrol. */
function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const STOPWORDS_ID = new Set(
  'yang dan di ke dari untuk dengan pada ini itu adalah akan tidak ada juga karena sebagai oleh atau anda kami mereka saya kita jika maka tetapi lebih sudah dapat telah menjadi sehingga antara namun seperti harus tentang terhadap saat bagi sampai dari pada dari para yaitu tersebut bisa harusnya pun punya ke atas bawah'
    .split(/\s+/)
);

/** Tokenisasi keyword sederhana: huruf/angka >=3 char, minus stopword Indonesia. */
function extractKeywords(text, limit = 20) {
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS_ID.has(t));
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/** Hash singkat deskripsi lowongan utk atsKeywordMatch.jobDescriptionHash. */
function shortHash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16);
}

/**
 * Escape regex — dipakai utk user input yang masuk ke $regex MongoDB
 * (anti ReDoS & regex injection). Lihat cv.controller listCvs.
 */
function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitasi nama file utk Content-Disposition & penyimpanan:
 * buang karakter kontrol/CRLF/quote (anti header injection), ganti path
 * separator, cap panjang 255. Anti path traversal via filename.
 */
function sanitizeFilename(name, fallback = 'file') {
  let s = String(name == null ? '' : name)
    .replace(/[\u0000-\u001F\u007F"]/g, '') // kontrol + CRLF + quote
    .replace(/[\\/]/g, '_') // path separator -> _
    .trim()
    .replace(/\.+$/, ''); // titik di akhir (bukan ekstensi)
  if (!s) s = fallback;
  return s.slice(0, 255);
}

module.exports = {
  generateMidtransOrderId,
  generateInvoiceNumber,
  hashToken,
  generateRandomToken,
  normalizeWhitespace,
  extractKeywords,
  shortHash,
  escapeRegex,
  sanitizeFilename,
};
