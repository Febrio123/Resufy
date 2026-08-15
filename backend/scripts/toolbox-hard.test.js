/**
 * Test mode kompresi 'hard' (agresif) — toolbox file compressor.
 * Jalankan: node scripts/toolbox-hard.test.js
 * TANPA server/DB: hanya service + sharp + pdf-lib + pdfkit.
 */
const assert = require('assert');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const PDFDocumentPdfKit = require('pdfkit');
const { compressFile } = require('../src/services/toolboxService');
const { rasterizePdfToJpegPages, embedRasterizedPdf } = require('../src/utils/pdfRasterize');

/** Buat noise RGB raw → buffer gambar. Noise = incompressible, cocok utk uji kompresi keras. */
async function noiseImage(width, height, format, quality) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 3) {
    raw[i] = Math.floor(Math.random() * 256);
    raw[i + 1] = Math.floor(Math.random() * 256);
    raw[i + 2] = Math.floor(Math.random() * 256);
  }
  let p = sharp(raw, { raw: { width, height, channels: 3 } });
  if (format === 'png') p = p.png();
  if (format === 'jpeg') p = p.jpeg({ quality: quality || 92, mozjpeg: false });
  return p.toBuffer();
}

async function textPdf(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocumentPdfKit({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica').fontSize(11).text(String(text));
    doc.end();
  });
}

async function main() {
  console.log('=== toolbox-hard.test.js ===');

  // ---- T1: gambar PNG besar → hard → mengecil drastis, output JPEG valid ----
  const png = await noiseImage(1200, 800, 'png');
  const r1 = await compressFile({ buffer: png, mimetype: 'image/png', originalname: 'foto.png', mode: 'hard' });
  assert.ok(r1.sizeAfter < r1.sizeBefore, `T1: hard harus mengecil (${r1.sizeBefore} -> ${r1.sizeAfter})`);
  assert.ok(['sharp-hard-55', 'none'].includes(r1.method), `T1: method harus sharp-hard-55/none, dapat ${r1.method}`);
  assert.strictEqual(r1.mime, 'image/jpeg');
  const meta1 = await sharp(r1.buffer).metadata();
  assert.strictEqual(meta1.format, 'jpeg', 'T1: output harus JPEG valid');
  console.log(`T1 PASS (hard gambar): ${r1.sizeBefore} -> ${r1.sizeAfter} bytes, method=${r1.method}`);

  // ---- T2: PDF berisi JPEG besar (q92 1600x1200) → hard → gambar di-re-encode ----
  const bigJpeg = await noiseImage(1600, 1200, 'jpeg', 92);
  const pdfDoc = await PDFDocument.create();
  const img = await pdfDoc.embedJpg(bigJpeg);
  const page = pdfDoc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  const pdfWithImage = await pdfDoc.save();

  const r2 = await compressFile({ buffer: pdfWithImage, mimetype: 'application/pdf', originalname: 'laporan.pdf', mode: 'hard' });
  assert.ok(r2.reencodedImages >= 1, `T2: harus ada gambar di-re-encode, dapat ${r2.reencodedImages}`);
  assert.ok(['pdf-hard-reencode', 'pdf-lib', 'none'].includes(r2.method), `T2: method tidak dikenal: ${r2.method}`);
  assert.ok(r2.sizeAfter < r2.sizeBefore, `T2: PDF berisi JPEG q92 harus mengecil (${r2.sizeBefore} -> ${r2.sizeAfter})`);
  const reloaded = await PDFDocument.load(r2.buffer); // output harus PDF VALID
  assert.ok(reloaded.getPageCount() === 1, 'T2: PDF hasil harus tetap 1 halaman');
  console.log(`T2 PASS (hard PDF re-encode): ${r2.sizeBefore} -> ${r2.sizeAfter} bytes, images=${r2.reencodedImages}, method=${r2.method}`);

  // ---- T3: PDF text-only → hard → tidak throw, TIDAK ada gambar ----
  const textOnly = await textPdf('Halo resufy — dokumen teks sederhana. '.repeat(200));
  const r3 = await compressFile({ buffer: textOnly, mimetype: 'application/pdf', originalname: 'surat.pdf', mode: 'hard' });
  assert.ok(['none', 'pdf-lib'].includes(r3.method), `T3: text-PDF tak mungkin 'hard' (method=${r3.method})`);
  assert.strictEqual(r3.reencodedImages, 0, 'T3: text-PDF tidak punya gambar untuk di-re-encode');
  await PDFDocument.load(r3.buffer); // tetap PDF valid
  console.log(`T3 PASS (hard PDF text-only): method=${r3.method}, images=${r3.reencodedImages}`);

  // ---- T4: default (TANPA mode) → PERILAKU LAMA (quality 80, method sharp-80) ----
  const jpeg92 = await noiseImage(900, 600, 'jpeg', 92);
  const r4 = await compressFile({ buffer: jpeg92, mimetype: 'image/jpeg', originalname: 'foto.jpg' });
  assert.ok(['sharp-80', 'none'].includes(r4.method), `T4: default harus sharp-80/none, dapat ${r4.method}`);
  assert.ok(r4.sizeAfter < r4.sizeBefore, 'T4: q92 -> q80 harus mengecil');
  const meta4 = await sharp(r4.buffer).metadata();
  assert.strictEqual(meta4.format, 'jpeg', 'T4: output harus JPEG');
  console.log(`T4 PASS (default = standard): ${r4.sizeBefore} -> ${r4.sizeAfter} bytes, method=${r4.method}`);

  // ---- T5: mode tidak valid → guard → perilaku standard, TIDAK throw ----
  const r5 = await compressFile({ buffer: jpeg92, mimetype: 'image/jpeg', originalname: 'foto.jpg', mode: 'extreme' });
  assert.ok(['sharp-80', 'none'].includes(r5.method), `T5: mode tak dikenal harus fallback ke standard (method=${r5.method})`);
  console.log(`T5 PASS (guard mode invalid - gambar): method=${r5.method}`);

  // ---- T6: gambar BESAR (2000x1500, ~MB) → ekstrem → JAUH lebih kecil (< 300KB) ----
  const huge = await noiseImage(2000, 1500, 'jpeg', 92);
  assert.ok(huge.length > 1024 * 1024, `T6: gambar uji harus > 1MB, dapat ${huge.length}`);
  const r6 = await compressFile({ buffer: huge, mimetype: 'image/jpeg', originalname: 'foto-besar.jpg', mode: 'ekstrem' });
  assert.ok(['sharp-extreme-30', 'none'].includes(r6.method), `T6: method harus sharp-extreme-30/none, dapat ${r6.method}`);
  assert.ok(r6.sizeAfter < 300 * 1024, `T6: ekstrem harus < 300KB (${r6.sizeBefore} -> ${r6.sizeAfter})`);
  const meta6 = await sharp(r6.buffer).metadata();
  assert.strictEqual(meta6.format, 'jpeg', 'T6: output harus JPEG valid');
  assert.ok(meta6.width <= 1024 && meta6.height <= 1024, `T6: dimensi harus ≤ 1024 (${meta6.width}x${meta6.height})`);
  console.log(`T6 PASS (ekstrem gambar): ${r6.sizeBefore} -> ${r6.sizeAfter} bytes, method=${r6.method}, ${meta6.width}x${meta6.height}`);

  // ---- T7: PDF ber-gambar → ekstrem TIDAK LEBIH BESAR dari hard (sama file) + valid ----
  const r7 = await compressFile({ buffer: pdfWithImage, mimetype: 'application/pdf', originalname: 'laporan.pdf', mode: 'ekstrem' });
  assert.ok(['pdf-extreme-reencode', 'pdf-hard-reencode', 'pdf-lib', 'none'].includes(r7.method), `T7: method tidak dikenal: ${r7.method}`);
  assert.ok(r7.sizeAfter <= r2.sizeAfter, `T7: ekstrem (${r7.sizeAfter}) harus <= hard (${r2.sizeAfter}) pada file yang sama`);
  const reloaded7 = await PDFDocument.load(r7.buffer); // output harus PDF VALID
  assert.ok(reloaded7.getPageCount() === 1, 'T7: PDF hasil harus tetap 1 halaman');
  console.log(`T7 PASS (ekstrem PDF ≤ hard): hard ${r2.sizeAfter} -> ekstrem ${r7.sizeAfter} bytes, images=${r7.reencodedImages}, method=${r7.method}`);

  // ---- T8: guard mode invalid pada jalur PDF (salah eja 'extreme') → tidak re-encode ----
  const r8 = await compressFile({ buffer: pdfWithImage, mimetype: 'application/pdf', originalname: 'laporan.pdf', mode: 'extreme' });
  assert.ok(['pdf-lib', 'none'].includes(r8.method), `T8: mode tak dikenal di PDF harus fallback ke standard (method=${r8.method})`);
  assert.strictEqual(r8.reencodedImages, 0, 'T8: mode invalid tidak boleh re-encode gambar');
  await PDFDocument.load(r8.buffer); // tetap PDF valid
  console.log(`T8 PASS (guard mode invalid - PDF): method=${r8.method}, images=${r8.reencodedImages}`);

  // ---- T9: PDF TEKS (4-5 halaman) mode ekstrem → kompresor teks (rasterisasi) ----
  const textDoc = await textPdf(('Paragraf teks panjang untuk uji rasterisasi PDF ekstrem. '.repeat(30) + '\n\n').repeat(45));
  const r9 = await compressFile({ buffer: textDoc, mimetype: 'application/pdf', originalname: 'dokumen-teks.pdf', mode: 'ekstrem' });
  assert.ok(['pdf-rasterized-extreme', 'pdf-lib', 'none'].includes(r9.method), `T9: method tidak dikenal: ${r9.method}`);
  const reloaded9 = await PDFDocument.load(r9.buffer); // output harus PDF VALID
  assert.ok(reloaded9.getPageCount() >= 1, 'T9: PDF hasil harus valid');
  const ratio9 = (r9.sizeAfter / r9.sizeBefore).toFixed(3);
  console.log(`T9 PASS (ekstrem PDF teks): ${r9.sizeBefore} -> ${r9.sizeAfter} bytes (rasio ${ratio9}), method=${r9.method}, pagesRasterized=${r9.pagesRasterized || 0}`);
  // Laporan transparan: ukuran hasil raster langsung (meski kalah, biar angka terlihat)
  const rast9 = await rasterizePdfToJpegPages(textDoc);
  const bufRast9 = await embedRasterizedPdf(rast9.jpegPages);
  console.log(`   LAPORAN T9: raster ${rast9.pageCount} halaman = ${bufRast9.length} B (${(bufRast9.length / r9.sizeBefore).toFixed(1)}x input) — pilih-terkecil memilih: ${r9.method} (input teks ringkas: raster hampir selalu lebih besar)`);

  // ---- T10: PDF ber-gambar (regresi T7) → ekstrem tetap mengecil via pilih-terkecil ----
  const r10 = await compressFile({ buffer: pdfWithImage, mimetype: 'application/pdf', originalname: 'laporan.pdf', mode: 'ekstrem' });
  assert.ok(r10.sizeAfter <= r10.sizeBefore, `T10: ekstrem tidak boleh membesarkan (${r10.sizeBefore} -> ${r10.sizeAfter})`);
  assert.ok(['pdf-extreme-reencode', 'pdf-rasterized-extreme', 'pdf-lib', 'none'].includes(r10.method), `T10: method tidak dikenal: ${r10.method}`);
  await PDFDocument.load(r10.buffer); // tetap PDF valid
  console.log(`T10 PASS (ekstrem PDF ber-gambar, pilih-terkecil): ${r10.sizeBefore} -> ${r10.sizeAfter} bytes, method=${r10.method}, images=${r10.reencodedImages}, pages=${r10.pagesRasterized || 0}`);

  console.log('OK — toolbox-hard.test.js: semua asersi T1..T10 lolos');
}

main().catch((err) => {
  console.error('GAGAL:', err);
  process.exit(1);
});
