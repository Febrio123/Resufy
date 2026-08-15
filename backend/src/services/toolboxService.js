/**
 * Toolbox service — fitur GRATIS 100% (tanpa pembayaran, tanpa login wajib):
 *  1. file-compressor : PDF (pdf-lib) & gambar (sharp quality 80)
 *  2. paraphraser     : parafrase AI utk TEKS (input JSON {text}) — skor AI
 *     sebelum → tulis ulang per-chunk → skor AI sesudah (target <15; iterasi
 *     ulang bila ≥30, maks 2 iterasi). Chain provider: **Gemini → Ollama lokal
 *     (fallback gratis/offline, §38)** → 502 bila dua-duanya gagal; skor null
 *     bila skor gagal (tidak memblok hasil). Kejujuran desain: skor "0% AI"
 *     TIDAK dijamin mutlak (indikator; variance antar panggilan Gemini terukur).
 *  3. document-scanner: deteksi tepi sederhana (threshold + bounding box, TANPA
 *     OpenCV — librari berat & bermasalah di Windows) → crop → normalize → PDF.
 *
 * CATATAN KETERBATASAN (jujur, utk fase 08): scanner tidak mempertahankan
 * layout/struktur dokumen (bounding box), karena tanpa OpenCV & tanpa
 * LibreOffice. Desain UI fase 03 memang menandai fitur ini MVP.
 * Paraphraser: hanya teks (tanpa file); struktur paragraf dipertahankan.
 * (File converter DIHAPUS 2026-08-15 atas keputusan user — §39.)
 */
const sharp = require('sharp');
const { PDFDocument, PDFName } = require('pdf-lib');
const { rasterizePdfToJpegPages, embedRasterizedPdf } = require('../utils/pdfRasterize');
const { logger } = require('../config/logger');
const { AppError } = require('../utils/AppError');
const { env } = require('../config/env');
const geminiDetector = require('../utils/geminiDetector'); // akses via property agar unit test bisa mock
const ollamaClient = require('../utils/ollamaClient'); // fallback lokal (akses via property agar bisa mock)

const IMAGE_FORMATS = ['jpeg', 'png', 'webp'];

// ---- Mode kompresi 'hard' (agresif) — diminta user; default tetap 'standard' ----
const HARD_IMAGE_QUALITY = 55; // quality JPEG mode hard (standard = 80)
const HARD_IMAGE_MAX_DIM = 1600; // dimensi maks gambar (fit inside, tanpa enlargement)
const HARD_PDF_IMAGE_QUALITY = 50; // quality re-encode gambar tertanam di PDF

// ---- Mode kompresi 'ekstrem' (paling agresif — MB → KB) ----
// Kualitas rendah: hasil utk lampiran/kirim cepat, BUKAN untuk cetak/presisi.
const EXTREME_IMAGE_QUALITY = 30; // quality JPEG mode ekstrem
const EXTREME_IMAGE_MAX_DIM = 1024; // dimensi maks gambar (fit inside, tanpa enlargement)
const EXTREME_PDF_IMAGE_QUALITY = 30; // quality re-encode gambar tertanam di PDF (ekstrem)
const EXTREME_PDF_IMAGE_MAX_DIM = 1200; // resize gambar tertanam > dim ini (fit inside) sebelum re-encode

function isImageMime(mime) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
}

function mimeToFormat(mime) {
  const map = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
  return map[mime] || null;
}

// ============================================================================
// 1. File compressor
// ============================================================================

/**
 * Hard/ekstrem PDF: re-encode SEMUA image stream tertanam (DCTDecode/JPEG &
 * FlateDecode) ke JPEG quality rendah via sharp, lalu MUTASI objek stream
 * langsung (`obj.contents = new Uint8Array(...)`). Saat serialize, pdf-lib
 * menulis ulang /Length dari contents → stream baru valid; dict /Filter
 * disesuaikan bila stream FlateDecode diubah jadi DCTDecode.
 * `maxDim` opsional (mode ekstrem): gambar lebih besar dari maxDim di-RESIZE
 * fit-inside SEBELUM re-encode — dict Width/Height TIDAK diubah (renderer
 * menskalakan stream → tampilan di PDF tetap sama, ukuran turun drastis).
 * Satu objek gagal → SKIP (JANGAN pernah crash/merusak dokumen).
 * @param {object} pdfDoc
 * @param {number} quality kualitas JPEG target
 * @param {number} [maxDim] resize gambar lebih besar dari ini (fit inside)
 * @returns {Promise<number>} jumlah objek gambar yang berhasil di-re-encode
 */
async function reencodePdfImages(pdfDoc, quality, maxDim) {
  let changed = 0;
  const items = pdfDoc.context.enumerateIndirectObjects(); // pasangan [ref, object]
  for (const [, obj] of items) {
    try {
      // Stream image = objek dengan `dict` + Subtype /Image
      if (!obj || typeof obj !== 'object' || !obj.dict) continue;
      const subtype = obj.dict.get(PDFName.of('Subtype'));
      if (!subtype || subtype.encodedName !== '/Image') continue;

      // Hanya DCTDecode (JPEG) & FlateDecode (PNG/Flate) — filter lain (JPXDecode
      // dll) di-SKIP agar tidak merusak. Filter array (berlapis) → skip.
      const filter = obj.dict.get(PDFName.of('Filter'));
      const filterName = filter && filter.encodedName;
      if (filterName !== '/DCTDecode' && filterName !== '/FlateDecode') continue;
      if (!obj.contents || obj.contents.length === 0) continue;

      const raw = Buffer.from(obj.contents);
      // PDFRawStream (DCT) = bytes gambar langsung; PDFFlateStream = bytes
      // TER-DEFLATE → sharp hampir pasti gagal → skip (aman).
      const meta = await sharp(raw).metadata().catch(() => null);
      if (!meta || !meta.format) continue;

      // Ekstrem: gambar > maxDim → resize fit-inside dulu (stream-nya saja;
      // dict Width/Height dibiarkan → tampilan PDF tetap, ukuran turun).
      let pipeline = sharp(raw);
      if (maxDim && meta.width > maxDim || maxDim && meta.height > maxDim) {
        pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true });
      }
      const re = await pipeline
        .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
        .toBuffer()
        .catch(() => null);
      if (!re || re.length >= raw.length) continue; // tidak mengecil → skip

      obj.contents = new Uint8Array(re);
      if (filterName === '/FlateDecode') {
        // Output sekarang JPEG (DCTDecode) → sinkronkan filter & hapus parms
        obj.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        obj.dict.delete(PDFName.of('DecodeParms'));
      }
      changed += 1;
    } catch (err) {
      // satu objek gagal → lanjut (JANGAN pernah gagalkan seluruh dokumen)
    }
  }
  return changed;
}

/**
 * Kompresi file. `mode`: 'standard' (default, perilaku lama) | 'hard' (agresif)
 * | 'ekstrem' (paling agresif — MB → KB, utk lampiran/kirim, bukan cetak).
 * Hard/ekstrem PDF: kompresor GAMBAR (re-encode gambar tertanam + buang
 * metadata; ekstrem menambah resize gambar > 1200px). Ekstrem PDF juga
 * menjalankan kompresor TEKS (rasterisasi halaman → JPEG — konsekuensi
 * disepakati: teks jadi gambar, tidak bisa dicari) lalu mengirim hasil
 * PALING KECIL. Hard gambar: ≤1600px q55; ekstrem: ≤1024px q30.
 * Fallback: hasil yang lebih besar dari input TIDAK pernah dikirim — pakai
 * asli (method 'none').
 * @param {{buffer: Buffer, mimetype: string, originalname: string, mode?: 'standard'|'hard'|'ekstrem'}}
 * @returns {{buffer: Buffer, mime: string, filename: string, sizeBefore: number, sizeAfter: number, method: string, reencodedImages?: number, pagesRasterized?: number}}
 */
async function compressFile({ buffer, mimetype, originalname = 'file', mode = 'standard' }) {
  const sizeBefore = buffer.length;
  const format = mimeToFormat(mimetype);
  const modeKey = String(mode); // guard: selain 'hard'/'ekstrem' → 'standard' (tidak throw)
  const hard = modeKey === 'hard';
  const extreme = modeKey === 'ekstrem';

  if (format === 'pdf') {
    const base = originalname.replace(/\.pdf$/i, '');

    // ==== KOMPRESOR 1: GAMBAR (re-encode gambar tertanam + buang metadata) ====
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (err) {
      throw new AppError(422, 'INVALID_FILE', 'File PDF rusak atau tidak dapat dibaca');
    }
    let reencoded = 0;
    if (hard || extreme) {
      reencoded = await reencodePdfImages(
        pdfDoc,
        extreme ? EXTREME_PDF_IMAGE_QUALITY : HARD_PDF_IMAGE_QUALITY,
        extreme ? EXTREME_PDF_IMAGE_MAX_DIM : undefined // hard: tanpa resize (perilaku sekarang)
      );
    }
    // Buang metadata — penyumbang ukuran terbesar di PDF sederhana
    pdfDoc.setTitle(''); pdfDoc.setAuthor(''); pdfDoc.setSubject(''); pdfDoc.setKeywords([]); pdfDoc.setProducer(''); pdfDoc.setCreator('');
    const outImage = await pdfDoc.save({ useObjectStreams: true });
    let methodImage = 'none';
    if (outImage.length < sizeBefore) {
      if (extreme && reencoded > 0) methodImage = 'pdf-extreme-reencode';
      else if (hard && reencoded > 0) methodImage = 'pdf-hard-reencode';
      else methodImage = 'pdf-lib';
    }
    const candidates = [{ buffer: outImage, method: methodImage, reencodedImages: reencoded, pagesRasterized: 0 }];

    // ==== KOMPRESOR 2: TEKS (rasterisasi halaman → JPEG) — HANYA mode ekstrem ====
    // Konsekuensi disepakati user: teks jadi GAMBAR (tidak bisa dicari/disalin) —
    // wajar utk kirim lampiran. Standard/hard TIDAK PERNAH rasterisasi.
    if (extreme) {
      try {
        const { jpegPages, pageCount } = await rasterizePdfToJpegPages(buffer);
        const outText = await embedRasterizedPdf(jpegPages);
        if (outText.length < sizeBefore) {
          candidates.push({ buffer: outText, method: 'pdf-rasterized-extreme', reencodedImages: reencoded, pagesRasterized: pageCount });
        }
      } catch (err) {
        // Rasterisasi gagal (native/pdf rusak dll) → log warn, LANJUT pakai
        // kompresor gambar — JANGAN pernah gagalkan request.
        logger.warn({ err: err.message }, 'rasterisasi PDF gagal — fallback ke kompresor gambar');
      }
    }

    // ==== PILIH PALING KECIL yang masih mengecil (jangan pernah kirim > input) ====
    const winner = candidates
      .filter((c) => c.buffer.length < sizeBefore)
      .sort((a, b) => a.buffer.length - b.buffer.length)[0];

    if (!winner) {
      return { buffer, mime: 'application/pdf', filename: `${base}_compressed.pdf`, sizeBefore, sizeAfter: sizeBefore, method: 'none', reencodedImages: reencoded, pagesRasterized: 0 };
    }
    return {
      buffer: winner.buffer, mime: 'application/pdf', filename: `${base}_compressed.pdf`,
      sizeBefore, sizeAfter: winner.buffer.length, method: winner.method,
      reencodedImages: winner.reencodedImages, pagesRasterized: winner.pagesRasterized,
    };
  }

  if (isImageMime(mimetype)) {
    let out;
    if (extreme) {
      out = await sharp(buffer)
        .resize({ width: EXTREME_IMAGE_MAX_DIM, height: EXTREME_IMAGE_MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: EXTREME_IMAGE_QUALITY, mozjpeg: true, chromaSubsampling: '4:2:0' })
        .toBuffer();
    } else if (hard) {
      out = await sharp(buffer)
        .resize({ width: HARD_IMAGE_MAX_DIM, height: HARD_IMAGE_MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: HARD_IMAGE_QUALITY, mozjpeg: true, chromaSubsampling: '4:2:0' })
        .toBuffer();
    } else {
      out = await sharp(buffer).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    }
    if (out.length >= sizeBefore) out = buffer;
    const base = originalname.replace(/\.[a-z0-9]+$/i, '');
    const method = out.length < sizeBefore ? (extreme ? 'sharp-extreme-30' : hard ? 'sharp-hard-55' : 'sharp-80') : 'none';
    return { buffer: out, mime: 'image/jpeg', filename: `${base}_compressed.jpg`, sizeBefore, sizeAfter: out.length, method };
  }

  throw new AppError(415, 'UNSUPPORTED_FORMAT', 'Hanya PDF & gambar (JPG/PNG/WebP) yang didukung untuk kompresi');
}

// ============================================================================
// 2. Paraphraser AI (input TEKS, JSON — bukan file DOCX lagi)
// ============================================================================

const PARAPHRASE_CHUNK_CHARS = 4000; // batas aman per request Gemini (token murah, hasil konsisten)
// Skor sesudah ≥ ambang ini → parafrase ulang (mengejar target <15; maks 2 iterasi).
const AI_SCORE_RETARGET_THRESHOLD = 30;
const AI_SCORE_MAX_ITERATIONS = 2; // total iterasi parafrase maksimal
const AI_SCORE_TARGET = 15; // target kuat skor akhir (jujur: "0% AI" tidak dijamin mutlak)
const MIN_PARAPHRASE_CHARS = 50; // < 50 karakter setelah trim → 422 (kontrak UI)
const MAX_PARAPHRASE_CHARS = 100000; // > 100.000 karakter → 422 (kontrak UI)
const SCORE_SAMPLE_CHARS = 30000; // sampling utk skor AI: head/mid/tail ≤ 30k (batas callModel)

/**
 * Sampling representatif utk skor AI bila teks sangat panjang (>30k chars):
 * ambil AWAL + TENGAH + AKHIR — detektor melihat variasi seluruh dokumen,
 * bukan hanya pembuka (truncate sederhana bisa bias ke gaya pembuka).
 */
function sampleForScore(text, limit = SCORE_SAMPLE_CHARS) {
  const t = String(text || '');
  if (t.length <= limit) return t;
  const head = Math.floor(limit * 0.4);
  const mid = Math.floor(limit * 0.25);
  const tail = limit - head - mid;
  const midStart = Math.floor(t.length / 2) - Math.floor(mid / 2);
  return `${t.slice(0, head)}\n[… bagian tengah di-sampling untuk skor …]\n${t.slice(midStart, midStart + mid)}\n[…]\n${t.slice(-tail)}`;
}

/**
 * Pecah teks jadi chunk ≤ maxChars:
 * - paragraf = dipisah blank line (`\n\n`); baris tunggal tetap satu paragraf.
 * - paragraf ≤ maxChars → batch beberapa paragraf (tanpa memotong di tengah).
 * - paragraf > maxChars → pecah PER KALIMAT; kalimat masih > maxChars → pecah
 *   PER KATA (tidak pernah memotong kata). Urutan & struktur paragraf dipertahankan.
 */
function splitTextChunks(text, maxChars) {
  const chunks = [];
  let buffer = [];
  let bufLen = 0;
  const flush = () => {
    if (buffer.length) { chunks.push(buffer.join('\n\n')); buffer = []; bufLen = 0; }
  };
  const add = (seg) => {
    if (buffer.length && bufLen + seg.length > maxChars) flush();
    buffer.push(seg);
    bufLen += seg.length + 2;
  };
  const addLong = (seg) => {
    const sentences = seg.match(/[^.!?\n]+[.!?]+["')]*\s*|[^.!?\n]+$/g) || [seg];
    for (let raw of sentences) {
      raw = raw.trim();
      if (!raw) continue;
      if (raw.length > maxChars) {
        const words = raw.split(/\s+/);
        let buf = '';
        for (const w of words) {
          if (buf && buf.length + w.length + 1 > maxChars) { add(buf); buf = w; }
          else buf = buf ? `${buf} ${w}` : w;
        }
        if (buf) add(buf);
      } else add(raw);
    }
  };
  for (const para of String(text).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    if (para.length > maxChars) addLong(para);
    else add(para);
  }
  flush();
  return chunks;
}

/**
 * Skor AI (0-100, 100 = pasti AI) — chain: **Gemini dulu** (bila key ada) →
 * **Ollama lokal** → dua-duanya gagal → `null` (skor TIDAK pernah memblok hasil
 * parafrase — user tetap dapat teks).
 * `usedProviders`: Set<string> yang diisi 'gemini'/'ollama' utk menentukan
 * field `provider` final (gemini | ollama | mixed).
 */
async function detectScore(text, usedProviders) {
  if (env.GEMINI_API_KEY) {
    try {
      const g = await geminiDetector.detectWithGemini(text);
      usedProviders.add('gemini');
      return g.score;
    } catch (err) {
      // warn tanpa key/URL (cause sudah di-scrub oleh geminiDetector)
      logger.warn({ stage: err.cause && err.cause.stage }, '[paraphraser] skor Gemini gagal — coba Ollama');
    }
  }
  try {
    const s = await ollamaClient.scoreWithOllama(text);
    usedProviders.add('ollama');
    return s;
  } catch (err) {
    logger.warn({ stage: err.cause && err.cause.stage }, '[paraphraser] skor Ollama gagal — skor null (tidak memblok hasil)');
  }
  return null;
}

/**
 * Parafrase satu chunk — chain: **Gemini → Ollama** (fallback otomatis saat
 * 429/quota/5xx/timeout/tanpa kunci). Dua-duanya gagal → throw 502 pesan aman
 * berisi panduan (tanpa detail internal).
 * `ollamaAvailable`: hasil cek `isOllamaAvailable` SEKALI per request (dihitung
 * di paraphraseText) — menghindari overhead/panggilan berulang per chunk.
 */
async function paraphraseChunk(chunk, usedProviders, ollamaAvailable) {
  if (env.GEMINI_API_KEY) {
    try {
      const r = await geminiDetector.paraphraseWithGemini(chunk);
      usedProviders.add('gemini');
      return r.text;
    } catch (err) {
      logger.warn({ stage: err.cause && err.cause.stage }, '[paraphraser] Gemini gagal — fallback Ollama');
    }
  }
  if (ollamaAvailable) {
    try {
      const r = await ollamaClient.paraphraseWithOllama(chunk);
      usedProviders.add('ollama');
      return r.text;
    } catch (err) {
      logger.warn({ stage: err.cause && err.cause.stage }, '[paraphraser] Ollama gagal — 502');
    }
  }
  throw new AppError(
    502,
    'AI_SERVICE_UNAVAILABLE',
    'Parafrase gagal — isi kunci Gemini atau aktifkan Ollama lokal (ollama pull qwen2.5:3b).'
  );
}

/**
 * Parafrase AI utk TEKS (stateless, input langsung — tanpa file).
 * Alur: trim + validasi panjang (50–100k) → cek ketersediaan Ollama (sekali,
 * utk fallback) → skor AI sebelum (Gemini → Ollama → null; sampling bila
 * panjang) → chunk ≤4000 chars (per paragraf/kalimat/kata, urutan dipertahankan)
 * → parafrase per chunk (chain Gemini → Ollama; dua-duanya gagal → 502 pesan
 * panduan) → gabung `\n\n` → skor AI sesudah → bila ≥30 iterasi ulang (maks 2;
 * skor null → 1 iterasi saja) → skor final.
 * @param {{text: string}}
 * @returns {Promise<{aiScoreBefore: number|null, aiScoreAfter: number|null, iterations: number, paraphrasedText: string, provider: 'gemini'|'ollama'|'mixed'}>}
 */
async function paraphraseText({ text }) {
  const trimmed = String(text ?? '').trim();
  if (trimmed.length < MIN_PARAPHRASE_CHARS) {
    throw new AppError(422, 'TEXT_TOO_SHORT', 'Teks terlalu pendek.');
  }
  if (trimmed.length > MAX_PARAPHRASE_CHARS) {
    throw new AppError(422, 'TEXT_TOO_LONG', 'Teks terlalu panjang.');
  }

  // Cek fallback SEKALI per request (Ollama mati → langsung 502 panduan,
  // tanpa menunggu timeout panjang per chunk). Tanpa Gemini & tanpa Ollama →
  // fitur tidak bisa jalan sama sekali.
  const ollamaAvailable = await ollamaClient.isOllamaAvailable();
  if (!env.GEMINI_API_KEY && !ollamaAvailable) {
    throw new AppError(
      502,
      'AI_SERVICE_UNAVAILABLE',
      'Parafrase gagal — isi kunci Gemini atau aktifkan Ollama lokal (ollama pull qwen2.5:3b).'
    );
  }
  const usedProviders = new Set();

  const aiScoreBefore = await detectScore(sampleForScore(trimmed), usedProviders);

  let chunks = splitTextChunks(trimmed, PARAPHRASE_CHUNK_CHARS);
  const chunkCount = chunks.length;
  let iterations = 0;
  let aiScoreAfter = null;
  let lastJoined = '';

  for (let iter = 0; iter < AI_SCORE_MAX_ITERATIONS; iter++) {
    iterations = iter + 1;
    const paraphrased = [];
    for (const chunk of chunks) {
      const out = await paraphraseChunk(chunk, usedProviders, ollamaAvailable);
      if (!out || !out.trim()) {
        throw new AppError(502, 'AI_SERVICE_EMPTY_RESULT', 'Layanan parafrase tidak memberikan hasil. Coba lagi.');
      }
      paraphrased.push(out);
    }
    lastJoined = paraphrased.join('\n\n');
    aiScoreAfter = await detectScore(sampleForScore(lastJoined), usedProviders);
    // Skor null (Gemini & Ollama keduanya gagal) → TIDAK bisa menilai hasil →
    // skip re-iterasi (1 iterasi saja); user tetap dapat teks.
    if (aiScoreAfter === null || aiScoreAfter < AI_SCORE_RETARGET_THRESHOLD) break;
    // Masih kental gaya AI → parafrase ulang hasil iterasi ini sebagai input
    chunks = splitTextChunks(lastJoined, PARAPHRASE_CHUNK_CHARS);
    if (chunks.length === 0) break;
  }

  // provider final: 'gemini' bila tidak ada sentuhan Ollama; 'ollama' bila
  // tidak ada sentuhan Gemini; selain itu (campur) → 'mixed'.
  let provider = 'mixed';
  if (!usedProviders.has('ollama')) provider = 'gemini';
  else if (!usedProviders.has('gemini')) provider = 'ollama';

  logger.info({ chars: trimmed.length, chunkCount, iterations, scoreBefore: aiScoreBefore, scoreAfter: aiScoreAfter, provider }, '[paraphraser] selesai');
  return {
    aiScoreBefore,
    aiScoreAfter,
    iterations,
    paraphrasedText: lastJoined.trim(),
    provider,
  };
}

module.exports = {
  compressFile,
  paraphraseText,
  SUPPORTED_IMAGE_FORMATS: IMAGE_FORMATS,
};
