/**
 * WINNOWING FINGERPRINTING — deteksi plagiasi antar dokumen (mirip MOSS/Turnitin).
 *
 * Algoritma (Schleimer, Wilkerson, Aiken 2003 — "Winnowing: Local Algorithms for
 * Document Fingerprinting"):
 * 1. Tokenisasi teks (sama seperti similarityService.tokenize: lowercase,
 *    buang non-alnum, split whitespace).
 * 2. k-gram = potongan k KATA berurutan; tiap k-gram di-hash (FNV-1a 32-bit).
 *    position = indeks kata awal k-gram.
 * 3. Sliding window berukuran w: pilih hash MINIMUM per window; push fingerprint
 *    hanya saat minimum BERUBAH antar window (hash minimum unik per window →
 *    tidak ada duplikat). Pilihan minimum = longest match + resisten parafrase.
 * 4. Teks dengan token < k → [] (terlalu pendek, tidak layak di-fingerprint).
 *
 * HASH FNV-1a 32-bit: 0x811c9dc5 ⊕ char → ×0x01000193 (Math.imul, >>>0). Bukan
 * rolling hash sesungguhnya (O(k) per k-gram) — cukup untuk segmen dokumen yang
 * kecil (≤ ratusan kata); sederhana & deterministik. base 31/polynomial tidak
 * dipakai agar kode tetap sederhana (k=5 → overhead O(5n) masih trivial).
 *
 * Privasi: yang keluar dari modul ini HANYA hash + posisi. Tidak ada teks mentah.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SPACE = 0x20; // separator antar kata saat hashing k-gram (beda "ab c" vs "a bc")

/** Normalisasi teks → array token (lowercase, huruf/angka saja). */
function tokenizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** FNV-1a 32-bit untuk satu string. */
function fnv1a(str) {
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h;
}

/**
 * Hash satu k-gram = FNV-1a berantai atas tiap token + separator spasi.
 * @param {string[]} tokens — array token (panjang k)
 * @returns {number} hash 32-bit unsigned
 */
function hashKgram(tokens) {
  let h = FNV_OFFSET;
  for (const t of tokens) {
    const s = String(t);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, FNV_PRIME) >>> 0;
    }
    h ^= SPACE;
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h;
}

/**
 * Hitung fingerprint Winnowing sebuah teks.
 * @param {string} text
 * @param {{k?: number, w?: number}} [opts] — k-gram & ukuran window (default k=5, w=4)
 * @returns {Array<{hash: string, position: number}>} — hash hex 8 digit + posisi kata awal
 */
function computeFingerprint(text, { k = 5, w = 4 } = {}) {
  const tokens = tokenizeText(text);
  if (tokens.length < k) return []; // terlalu pendek → tidak layak fingerprint

  const grams = [];
  for (let i = 0; i <= tokens.length - k; i += 1) {
    grams.push({ hash: hashKgram(tokens.slice(i, i + k)), position: i });
  }

  const fingerprints = [];
  let curMin = null; // fingerprint terakhir yang di-push ({hash, position})
  for (let i = 0; i <= grams.length - w; i += 1) {
    // minimum dalam window [i, i+w); tie-break: posisi terkecil (paling kiri)
    let min = grams[i];
    for (let j = i + 1; j < i + w; j += 1) {
      if (grams[j].hash < min.hash || (grams[j].hash === min.hash && grams[j].position < min.position)) {
        min = grams[j];
      }
    }
    // push hanya saat minimum BERUBAH antar window (hindari duplikat)
    if (!curMin || curMin.hash !== min.hash || curMin.position !== min.position) {
      fingerprints.push({ hash: min.hash.toString(16).padStart(8, '0'), position: min.position });
      curMin = { hash: min.hash, position: min.position };
    }
  }
  return fingerprints;
}

/**
 * Jaccard similarity dari SET hash dua fingerprint (0-1).
 * Menerima array fingerprint objects ({hash}) atau array string hash.
 */
function jaccardHash(aHashes, bHashes) {
  const toSet = (arr) => new Set((arr || []).map((x) => (typeof x === 'string' ? x : x.hash)));
  const a = toSet(aHashes);
  const b = toSet(bHashes);
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

module.exports = { hashKgram, tokenizeText, computeFingerprint, jaccardHash };
