/**
 * Rasterisasi PDF → halaman JPEG (mode EKSTREM saja — konsekuensi disepakati:
 * teks jadi GAMBAR, tidak bisa dicari/disalin; wajar utk kirim lampiran).
 *
 * Stack & alasan (Windows dev, TANPA poppler):
 *  - `pdfjs-dist` (legacy build, ESM via dynamic import — aman di CJS & `npm run check`)
 *  - `@napi-rs/canvas` (native prebuilt Windows — dirender tanpa browser/worker)
 *  - `dommatrix` (polyfill DOMMatrix yang wajib ada di Node utk pdfjs)
 *  - `pdf-lib` (embed hasil JPEG ke PDF baru)
 *
 * POLYFILL global (wajib SEBELUM pdfjs di-load):
 *  - `globalThis.DOMMatrix` dari paket 'dommatrix' — pdfjs legacy membuat
 *    `new DOMMatrix()` saat module di-load; Node TIDAK punya global ini.
 *  - `Promise.withResolvers` — sudah tersedia Node ≥ 22 (resufy = v26); guard
 *    polyfill kecil utk keamanan bila dijalankan di Node lama.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const { PDFDocument } = require('pdf-lib');
const { createCanvas } = require('@napi-rs/canvas');

if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = require('dommatrix'); // paket ini export class langsung
}
if (!Promise.withResolvers) {
  // Node < 22 — polyfill minimal (spesifikasi sama)
  Promise.withResolvers = function withResolvers() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

/** Load legacy build pdfjs-dist (ESM) — dynamic import + file:// (Windows-safe). */
let pdfjsLibPromise = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    const entry = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjsLibPromise = import(pathToFileURL(entry).href);
  }
  return pdfjsLibPromise;
}

/** URL folder standard_fonts pdfjs-dist (glyph font standar Helvetica dll). */
function standardFontDataUrl() {
  const pkg = path.dirname(require.resolve('pdfjs-dist/package.json'));
  return pathToFileURL(path.join(pkg, 'standard_fonts') + path.sep).href;
}

/**
 * Render SEMUA halaman PDF menjadi JPEG (~130 DPI saat scale 1.8).
 * @param {Buffer} buffer PDF input
 * @param {{scale?: number}} [opts] scale viewport (1.8 ≈ 130 DPI)
 * @returns {Promise<{jpegPages: {jpeg: Buffer, widthPt: number, heightPt: number}[], pageCount: number}>}
 * @throws kalau loading/rendering gagal — pemanggil wajib fallback
 */
async function rasterizePdfToJpegPages(buffer, { scale = 1.8 } = {}) {
  const pdfjsLib = await loadPdfjs();
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: standardFontDataUrl(),
    isEvalSupported: false, // Node: no eval
    useSystemFonts: false,
    disableFontFace: true, // canvas Node: no font-face embedding
  }).promise;

  try {
    const jpegPages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const width = Math.floor(viewport.width);
      const height = Math.floor(viewport.height);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      // NOTE: number 60 (BUKAN {quality:60}) — terverifikasi empiris: object
      // config tidak diterapkan utk jpeg di @napi-rs/canvas → quality lebih
      // tinggi & file lebih besar. Number = kualitas 60 pasti.
      const jpeg = canvas.toBuffer('image/jpeg', 60);
      jpegPages.push({ jpeg, widthPt: viewport.width, heightPt: viewport.height });
      page.cleanup();
    }
    return { jpegPages, pageCount: jpegPages.length };
  } finally {
    // pdfjs 6.x: `destroy()` dihapus — cukup `cleanup()` utk lepas resource
    if (typeof doc.cleanup === 'function') {
      await doc.cleanup();
    }
  }
}

/**
 * Embed halaman JPEG ke PDF baru (pdf-lib) — tiap halaman 1 gambar penuh.
 * @param {{jpeg: Buffer, widthPt: number, heightPt: number}[]} jpegPages
 * @returns {Promise<Buffer>} PDF hasil
 */
async function embedRasterizedPdf(jpegPages) {
  const out = await PDFDocument.create();
  for (const { jpeg, widthPt, heightPt } of jpegPages) {
    const img = await out.embedJpg(jpeg);
    const page = out.addPage([widthPt, heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: widthPt, height: heightPt });
  }
  return out.save();
}

module.exports = { rasterizePdfToJpegPages, embedRasterizedPdf };
