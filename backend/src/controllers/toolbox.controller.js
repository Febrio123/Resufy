/**
 * Toolbox controller — fitur GRATIS, boleh TANPA login (userId null dicatat).
 * Proses file in-memory (multer memoryStorage) → respons stream buffer.
 * /ai-check & /paraphrase: respons JSON — skor dalam BODY (bukan header).
 * Setiap panggilan dicatat ke ToolboxUsageLog (untuk analitik & monitoring).
 */const { ToolboxUsageLog } = require('../models/toolboxUsageLog.model');
const { AppError } = require('../utils/AppError');
const { detectAi } = require('../utils/aiDetector');
const { detectWithGemini } = require('../utils/geminiDetector');
const { env } = require('../config/env');
const { toolboxService } = require('../services/index');
const { logger } = require('../config/logger');
const { assertFileMime, detectMime } = require('../utils/fileSecurity');
const { sanitizeFilename } = require('../utils/helpers');

/**
 * Wrapper: jalankan handler, catat log sukses/gagal + durasi.
 * Result binary (`buffer`) → respons stream + Content-Disposition (compress).
 * Result JSON (`aiScoreAfter` dll) → `res.json` — skor dalam body (paraphraser).
 */
async function withLog(req, res, toolType, handler) {
  const started = Date.now();
  const inputFile = req.file
    ? { name: sanitizeFilename(req.file.originalname, 'file'), mime: req.file.mimetype, size: req.file.size }
    : undefined;
  const inputChars = typeof req.body?.text === 'string' ? req.body.text.length : undefined;
  try {
    const result = await handler();
    await ToolboxUsageLog.create({
      userId: req.user ? req.user._id : null,
      toolType,
      inputFile,
      // Ringkasan input teks (hanya jumlah karakter — teks TIDAK disimpan)
      inputText: inputChars !== undefined ? { chars: inputChars } : undefined,
      outputFile: result.buffer ? { name: result.filename, mime: result.mime, size: result.buffer.length } : undefined,
      output: typeof result.aiScoreAfter === 'number' ? { score: result.aiScoreAfter, engine: result.provider || 'gemini' } : undefined,
      status: 'success',
      durationMs: Date.now() - started,
    });
    if (result.buffer) {
      res.setHeader('Content-Type', result.mime);
      // filename disanitasi (anti header injection CRLF/quote)
      res.setHeader('Content-Disposition', `attachment; filename="${ sanitizeFilename(result.filename, 'resufy_output') }"`);
      return res.send(result.buffer);
    }
    return res.json({
      aiScoreBefore: result.aiScoreBefore,
      aiScoreAfter: result.aiScoreAfter,
      iterations: result.iterations,
      paraphrasedText: result.paraphrasedText,
      provider: result.provider,
    });
  } catch (err) {
    await ToolboxUsageLog.create({
      userId: req.user ? req.user._id : null,
      toolType,
      inputFile,
      inputText: inputChars !== undefined ? { chars: inputChars } : undefined,
      status: 'failed',
      durationMs: Date.now() - started,
      errorMessage: err.message || String(err),
    });
    throw err;
  }
}

function requireFile(req) {
  if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'File wajib diupload (field: file)');
  // Magic bytes: MIME header dari client bisa dipalsukan — cek isi file.
  // txt/docx tanpa magic expectation dilewatkan; service yang menolak format.
  assertFileMime(req.file.buffer, req.file.mimetype);
}

const compress = async (req, res) => {
  requireFile(req);
  // Mode kompresi: 'standard' (default — perilaku lama) | 'hard' (agresif).
  // Guard di sini & di service: selain 'hard' → 'standard'.
  const mode = String(req.body?.mode || 'standard');
  await withLog(req, res, 'file_compressor', () =>
    toolboxService.compressFile({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      mode,
    })
  );
};

const paraphrase = async (req, res) => {
  // Validasi panjang/schema zod sudah di route (validate(paraphraseSchema));
  // guard ganda tetap di service (TEXT_TOO_SHORT/TEXT_TOO_LONG, 50–100k chars).
  await withLog(req, res, 'paraphraser', () =>
    toolboxService.paraphraseText({ text: req.body.text })
  );
};

const aiCheck = async (req, res) => {
  // Multer memoryStorage: request JSON / tanpa multipart → req.file undefined,
  // TIDAK error — teks via body atau file (pdf/docx/txt/doc) opsional.
  const started = Date.now();
  const inputFile = req.file
    ? { name: sanitizeFilename(req.file.originalname, 'file'), mime: req.file.mimetype, size: req.file.size }
    : null;
  try {
    const text = String(req.body?.text || '').trim();
    let fileText = '';
    if (req.file) {
      const { similarityService } = require('../services/index');
      // detectMime (magic bytes) → fileType yang dipahami extractText.
      const magic = detectMime(req.file.buffer);
      let fileType = null;
      if (magic === 'pdf') fileType = 'pdf';
      else if (magic === 'zip') fileType = 'docx'; // OOXML (docx)
      else if (magic === 'ole') fileType = 'doc'; // Word 97-2003
      else if (req.file.mimetype === 'text/plain') fileType = 'txt';
      if (!fileType) {
        throw new AppError(415, 'UNSUPPORTED_FORMAT', 'AI checker menerima teks atau file PDF/DOCX/TXT/DOC — bukan gambar.');
      }
      let extracted;
      try {
        extracted = await similarityService.extractText(req.file.buffer, fileType);
      } catch (err) {
        throw new AppError(422, 'INVALID_FILE', 'File tidak dapat dibaca (mungkin rusak atau terproteksi) — unggah ulang file yang valid.');
      }
      fileText = String(extracted || '').trim();
    }
    const sourceText = [text, fileText].filter(Boolean).join('\n');

    if (!sourceText.trim()) {
      throw new AppError(422, 'INVALID_TEXT', 'Tempel teks atau unggah file (PDF/DOCX/TXT) untuk dicek.');
    }

    // Heuristik lokal SELALU dihitung (murah) — dipakai utk textStats &
    // breakdown di kedua engine; sekaligus validasi panjang teks (< 100 kata
    // → 422 TEXT_TOO_SHORT) SEBELUM memanggil Gemini (hemat token).
    const local = detectAi(sourceText);
    if (local.insufficient) {
      throw new AppError(422, 'TEXT_TOO_SHORT', 'Teks terlalu pendek — minimal 100 kata untuk hasil yang akurat.');
    }

    // --- engine: Gemini bila key tersedia, fallback lokal bila gagal ---
    let result;
    if (env.GEMINI_API_KEY) {
      try {
        const g = await detectWithGemini(sourceText);
        result = {
          score: g.score,
          label: g.label,
          engine: 'gemini',
          textStats: local.textStats,
          breakdown: local.breakdown,
          reasoning: g.reasoning,
          note: 'Deteksi berbasis model Gemini (free tier). Hasil indikatif, bukan bukti mutlak; free tier Google dapat menggunakan data untuk peningkatan layanan.',
        };
      } catch (err) {
        // JANGAN pernah gagalkan request — warn (tanpa key/URL di log) + fallback.
        logger.warn({ err, stage: err.cause && err.cause.stage }, '[ai-check] Gemini gagal — fallback ke heuristik lokal');
      }
    }
    if (!result) {
      result = {
        score: local.score,
        label: local.label,
        engine: 'local',
        textStats: local.textStats,
        breakdown: local.breakdown,
        note: local.note,
      };
    }

    await ToolboxUsageLog.create({
      userId: req.user ? req.user._id : null,
      toolType: 'ai_checker',
      inputFile,
      inputText: { chars: sourceText.length },
      output: { score: result.score, engine: result.engine },
      status: 'success',
      durationMs: Date.now() - started,
    });

    res.json(result);
  } catch (err) {
    await ToolboxUsageLog.create({
      userId: req.user ? req.user._id : null,
      toolType: 'ai_checker',
      inputFile,
      inputText: req.body?.text ? { chars: String(req.body.text).length } : undefined,
      status: 'failed',
      durationMs: Date.now() - started,
      errorMessage: err.message || String(err),
    });
    throw err;
  }
};

module.exports = { compress, paraphrase, aiCheck };
