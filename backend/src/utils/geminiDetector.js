/**
 * Gemini Detector — engine API untuk AI Content Detector.
 *
 * - DIPAKAI HANYA bila env.GEMINI_API_KEY terisi (lihat controller aiCheck).
 * - Semua kegagalan (429/5xx/timeout/parse) → THROW Error dengan `cause`
 *   jelas → pemanggil harus fallback ke heuristik lokal (JANGAN gagalkan request).
 * - JANGAN pernah log URL lengkap / API key (key ada di query string).
 *
 * Model default gemini-2.5-flash (gemini-2.0-flash sudah tidak tersedia
 * sejak Juni 2026). Tanpa SDK — axios (dependensi existing) ke REST API.
 */
const axios = require('axios');
const { env } = require('../config/env');

const API_TIMEOUT_MS = 20000;
const MAX_TEXT_CHARS = 30000;

const LABELS = [
  'Kemungkinan besar ditulis manusia',
  'Sebagian besar ditulis manusia',
  'Campuran — kemungkinan disunting AI',
  'Kemungkinan besar ditulis AI',
];

function buildPrompt(text) {
  const clamped = text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n[…]` : text;
  return (
    'Kamu adalah detektor konten AI. Nilai teks berikut: seberapa besar kemungkinan teks ini ditulis oleh AI (ChatGPT/Gemini/LLM lain) vs manusia. ' +
    'Pertimbangkan: keragaman panjang kalimat, kosakata, frasa khas AI, alur & kesalahan alami manusia. ' +
    'Berikan score 0-100 (100 = pasti AI), label: pilih salah satu dari ' +
    JSON.stringify(LABELS) +
    ', dan reasoning singkat (maks 2 kalimat, Bahasa Indonesia). ' +
    'JANGAN pernah menyatakan hasil sebagai bukti mutlak.\n' +
    `Teks: """${clamped}"""`
  );
}

/** Normalisasi label model → salah satu dari 4 pilihan exact. null = tidak dikenali. */
function normalizeLabel(label) {
  const s = String(label || '').toLowerCase().replace(/\s*[-–]\s*/g, ' ');
  if (s.includes('campuran') || s.includes('disunting')) return LABELS[2];
  if (s.includes('sebagian besar')) return LABELS[1];
  if (s.includes('ditulis manusia') || s.includes('kemungkinan besar manusia')) return LABELS[0];
  if (s.includes('ditulis ai') || s.includes('ai') || s.includes('artificial')) return LABELS[3];
  return null;
}

/** Label fallback berdasarkan skor (kontrak band heuristik — konsisten dgn detectAi). */
function labelFromScore(score) {
  if (score <= 24) return LABELS[0];
  if (score <= 49) return LABELS[1];
  if (score <= 74) return LABELS[2];
  return LABELS[3];
}

/**
 * Satu panggilan generateContent ke satu model. Throw Error dgn err.cause
 * {stage, code, message} — pemanggil (detectWithGemini) memutuskan retry.
 */
async function callModel(model, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  let response;
  try {
    response = await axios.post(
      url,
      {
        contents: [{ role: 'user', parts: [{ text: buildPrompt(String(text || '')) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              score: { type: 'NUMBER' },
              label: { type: 'STRING' },
              reasoning: { type: 'STRING' },
            },
            required: ['score', 'label'],
          },
        },
      },
      { timeout: API_TIMEOUT_MS, maxRedirects: 0 }
    );
  } catch (err) {
    // axios error — jangan sertakan URL/config (bisa memuat key di query string)
    const status = err.response ? err.response.status : null;
    const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
    const stage = isTimeout ? 'timeout' : status ? `http_${status}` : 'network';
    const e = new Error(`Gemini API tidak dapat diakses (${stage})`);
    e.cause = { stage, code: err.code || null, message: err.message };
    throw e;
  }

  // --- parse payload ---
  let textPart;
  try {
    textPart = response.data.candidates[0].content.parts[0].text;
  } catch (err) {
    const e = new Error('Gemini API respons tidak valid (candidates kosong)');
    e.cause = { stage: 'parse', code: 'EMPTY_CANDIDATES', message: err.message };
    throw e;
  }

  let parsed;
  try {
    parsed = JSON.parse(textPart);
  } catch (err) {
    const e = new Error('Gemini API respons tidak valid (JSON tidak dapat di-parse)');
    e.cause = { stage: 'parse', code: 'BAD_JSON', message: err.message, snippet: String(textPart).slice(0, 120) };
    throw e;
  }

  const rawScore = Number(parsed.score);
  if (!Number.isFinite(rawScore)) {
    const e = new Error('Gemini API respons tidak valid (score bukan angka)');
    e.cause = { stage: 'parse', code: 'BAD_SCORE', message: JSON.stringify(parsed).slice(0, 200) };
    throw e;
  }
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const label = normalizeLabel(parsed.label) || labelFromScore(score);
  const reasoning = String(parsed.reasoning || '').trim();

  return { score, label, reasoning };
}

/**
 * @param {string} text
 * @returns {Promise<{score:number, label:string, reasoning:string}>}
 * @throws {Error} cause {stage, code, message} — pemanggil fallback local.
 *
 * GEMINI_MODEL boleh daftar CSV (mis. 'gemini-3.7-flash,gemini-flash-latest') —
 * retry model berikutnya saat 429/5xx/timeout ("high demand" sering temporer).
 * 400/404/parse → gagal langsung (tidak membuang kuota utk retry sia-sia).
 */
async function detectWithGemini(text) {
  const models = String(env.GEMINI_MODEL || 'gemini-3.7-flash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let lastErr = null;
  for (const model of models) {
    try {
      return await callModel(model, text);
    } catch (err) {
      lastErr = err;
      const stage = err.cause && err.cause.stage;
      const retriable = stage === 'timeout' || stage === 'network' || ['http_429', 'http_500', 'http_502', 'http_503'].includes(stage);
      if (!retriable) throw err; // 400/401/404/parse — retry ke model lain sia-sia
    }
  }
  throw lastErr;
}

// ============================================================================
// Parafrase AI (toolbox) — reuse pola callModel/detectWithGemini (chain CSV,
// retriable stages, TANPA log key/URL). Berbeda hanya prompt & responseSchema.
// ============================================================================

const PARAPHRASE_MAX_TEXT_CHARS = 20000; // per-chunk request (service sudah chunk ~4000)

function buildParaphrasePrompt(text) {
  const clamped = text.length > PARAPHRASE_MAX_TEXT_CHARS ? `${text.slice(0, PARAPHRASE_MAX_TEXT_CHARS)}\n[…]` : text;
  return (
    'Kamu adalah editor profesional yang mahir menulis ulang (parafrase) agar terdengar seperti tulisan manusia asli. ' +
    'Ubah kalimat dan struktur di teks berikut, tetapi: ' +
    '(1) PERTAHANKAN semua fakta, angka, nama orang/lembaga, tanggal, istilah teknis, dan makna asli — JANGAN menambah atau menghilangkan informasi; ' +
    '(2) gunakan variasi panjang kalimat (campur kalimat pendek dan panjang) dan variasi kosakata alami manusia; ' +
    '(3) HINDARI frasa klise khas AI seperti "selain itu", "dengan demikian", "secara keseluruhan", "penting untuk dicatat", "dapat disimpulkan", "tidak dapat dipungkiri", "dalam konteks ini", "sangat penting", "sebagai hasilnya", "furthermore", "moreover", "in conclusion"; ' +
    '(4) jangan mulai dengan frasa pengantar seperti "Berikut adalah..." dan jangan menambahkan komentar/kutipan di luar isi; ' +
    '(5) gunakan bahasa yang SAMA dengan teks asli (Indonesia/Inggris); ' +
    '(6) hasilkan langsung teks hasil parafrase, lengkap semua paragraf, siap pakai tanpa intro; ' +
    '(7) variasikan STRUKTUR kalimat secara radikal: campur kalimat sangat pendek dan panjang, kalimat langsung dan tidak langsung, kadang kalimat tanpa subjek — jangan biarkan banyak kalimat berpola seragam (mis. semuanya "Subjek + predikat + objek"); ' +
    '(8) bila ide yang sama muncul di beberapa paragraf, tulis ulang dengan ekspresi dan struktur kalimat yang BERBEDA di tiap paragraf — jangan mengulang pola kalimat yang sama; hindari pengulangan kata yang berlebihan antar paragraf; ' +
    '(9) pertahankan STRUKTUR PARAGRAF: jumlah paragraf hasil harus SAMA dengan input — jangan menggabungkan beberapa paragraf menjadi satu, dan jangan memecah satu paragraf menjadi banyak.\n' +
    `Teks: """${clamped}"""`
  );
}

/**
 * Satu panggilan parafrase ke satu model. Throw Error dgn err.cause
 * {stage, code, message} — pemanggil (paraphraseWithGemini) memutuskan retry.
 * @returns {Promise<{text: string}>}
 */
async function callParaphrase(model, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  let response;
  try {
    response = await axios.post(
      url,
      {
        contents: [{ role: 'user', parts: [{ text: buildParaphrasePrompt(String(text || '')) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              text: { type: 'STRING' },
            },
            required: ['text'],
          },
        },
      },
      { timeout: API_TIMEOUT_MS, maxRedirects: 0 }
    );
  } catch (err) {
    // axios error — jangan sertakan URL/config (bisa memuat key di query string)
    const status = err.response ? err.response.status : null;
    const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
    const stage = isTimeout ? 'timeout' : status ? `http_${status}` : 'network';
    const e = new Error(`Gemini API tidak dapat diakses (${stage})`);
    e.cause = { stage, code: err.code || null, message: err.message };
    throw e;
  }

  let textPart;
  try {
    textPart = response.data.candidates[0].content.parts[0].text;
  } catch (err) {
    const e = new Error('Gemini API respons tidak valid (candidates kosong)');
    e.cause = { stage: 'parse', code: 'EMPTY_CANDIDATES', message: err.message };
    throw e;
  }

  let parsed;
  try {
    parsed = JSON.parse(textPart);
  } catch (err) {
    const e = new Error('Gemini API respons tidak valid (JSON tidak dapat di-parse)');
    e.cause = { stage: 'parse', code: 'BAD_JSON', message: String(textPart).slice(0, 120) };
    throw e;
  }

  const outText = String(parsed.text || '').trim();
  if (!outText) {
    const e = new Error('Gemini API respons tidak valid (parafrase kosong)');
    e.cause = { stage: 'parse', code: 'EMPTY_TEXT', message: JSON.stringify(parsed).slice(0, 200) };
    throw e;
  }

  return { text: outText };
}

/**
 * @param {string} text satu chunk teks
 * @returns {Promise<{text: string}>}
 * @throws {Error} cause {stage, code, message} — pemanggil (toolboxService)
 *   memutuskan retry / error 502 aman. Chain CSV model + retriable sama seperti
 *   detectWithGemini; 400/404/parse → gagal langsung.
 */
async function paraphraseWithGemini(text) {
  const models = String(env.GEMINI_MODEL || 'gemini-3.7-flash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let lastErr = null;
  for (const model of models) {
    try {
      return await callParaphrase(model, text);
    } catch (err) {
      lastErr = err;
      const stage = err.cause && err.cause.stage;
      const retriable = stage === 'timeout' || stage === 'network' || ['http_429', 'http_500', 'http_502', 'http_503'].includes(stage);
      if (!retriable) throw err;
    }
  }
  throw lastErr;
}

module.exports = { detectWithGemini, paraphraseWithGemini, buildParaphrasePrompt, labelFromScore, normalizeLabel };
