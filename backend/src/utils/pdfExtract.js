/**
 * Ekstraksi teks PDF — berbasis `unpdf` (wrapper resmi pdfjs-dist untuk Node).
 * LATAR BELAKANG KEPUTUSAN (catat ke memory & decisions-log):
 * pdf-parse 1.1.1 (membungkus pdf.js v1.10.100, rilis 2016) GAGAL tidak
 * konsisten saat dimuat bersama module lain di Node 26 (error acak:
 * "bad XRef entry", "Invalid number: À", "Illegal character") meski bekerja
 * di proses bersih. Pengganti: unpdf v0.12 (pdfjs-dist modern, maintenance
 * aktif) yang mengurus worker internally — diakses via dynamic import ESM
 * dari CommonJS.
 */
let unpdfPromise = null;

async function getUnpdf() {
  if (!unpdfPromise) {
    unpdfPromise = import('unpdf');
  }
  return unpdfPromise;
}

/**
 * Ekstrak semua teks dari buffer PDF.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractPdfText(buffer) {
  const { extractText } = await getUnpdf();
  const result = await extractText(new Uint8Array(buffer));
  return String(result.text || '');
}

module.exports = { extractPdfText };
