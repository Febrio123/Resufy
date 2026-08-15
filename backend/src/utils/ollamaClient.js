/**
 * Ollama Client — fallback LLM LOKAL (gratis, offline, TANPA kunci API) untuk
 * fitur Parafrase AI (toolbox). Dipakai OTOMATIS saat Gemini gagal (429
 * quota/5xx/timeout/tanpa kunci) — tujuan: fitur tidak bergantung pada kuota
 * Gemini yang habis.
 *
 * - callOllama: POST {OLLAMA_URL}/api/chat (format Ollama: model, messages,
 *   stream:false, options.temperature). fetch + AbortController timeout
 *   OLLAMA_TIMEOUT_MS (default 120s — model CPU lambat, first-load lambat).
 * - isOllamaAvailable: GET {OLLAMA_URL}/api/tags, timeout singkat 3s — TIDAK
 *   pernah crash walau server mati (return false).
 * - Semua error → throw OllamaError dengan `cause {stage, code, message}`
 *   (pola sama geminiDetector). Pesan ramah bahasa Indonesia; bedakan
 *   "server mati" vs "model belum di-pull" (404 / "model not found").
 *
 * Instalasi utk user: `winget install Ollama.Ollama` → `ollama serve` →
 * `ollama pull qwen2.5:3b`.
 */
const { env } = require('../config/env');
const { buildParaphrasePrompt } = require('./geminiDetector');

const CHECK_TIMEOUT_MS = 3000; // isOllamaAvailable: singkat, jangan menahan request
const MAX_TEXT_CHARS = 30000; // clamp teks utk scoring (konsisten geminiDetector)

class OllamaError extends Error {
  constructor(message, cause = {}) {
    super(message);
    this.name = 'OllamaError';
    this.cause = cause;
  }
}

/** Prompt skor AI (0-100) — jawaban HANYA angka agar mudah di-parse. */
function buildScorePrompt(text) {
  const clamped = String(text || '').length > MAX_TEXT_CHARS ? `${String(text || '').slice(0, MAX_TEXT_CHARS)}\n[…]` : String(text || '');
  return (
    'Kamu adalah detektor konten AI. Nilai teks berikut: seberapa besar kemungkinan teks ini ditulis oleh AI (ChatGPT/Gemini/LLM lain) vs manusia. ' +
    'Pertimbangkan: keragaman panjang kalimat, kosakata, frasa khas AI, alur & kesalahan alami manusia. ' +
    'Berikan score 0-100 (100 = pasti AI). ' +
    'Jawab HANYA dengan satu angka (contoh: 72). Tanpa penjelasan, tanpa teks lain.\n' +
    `Teks: """${clamped}"""`
  );
}

/**
 * Satu panggilan chat ke Ollama.
 * @param {{prompt: string, system?: string}}
 * @returns {Promise<{text: string}>} isi `message.content` (trim).
 * @throws {OllamaError} cause {stage, code, message}
 */
async function callOllama({ prompt, system }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.OLLAMA_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: String(prompt || '') },
        ],
        stream: false,
        options: { temperature: 0.7 },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const stage = err.name === 'AbortError' ? 'timeout' : 'network';
    // TIDAK log URL/payload — hanya stage & code
    throw new OllamaError(
      stage === 'timeout'
        ? `Ollama tidak merespons dalam ${Math.round(env.OLLAMA_TIMEOUT_MS / 1000)} detik. Model CPU bisa lambat — coba model lebih kecil atau tunggu sebentar.`
        : 'Ollama tidak dapat diakses. Pastikan Ollama berjalan (ollama serve) di ' + env.OLLAMA_URL + '.',
      { stage, code: err.code || err.name, message: err.message }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let bodyText = '';
    try { bodyText = await res.text(); } catch (err) { /* ignore */ }
    const notFound = res.status === 404 || /model ['"]?[\w.:-]+['"]? not found/i.test(bodyText);
    if (notFound) {
      throw new OllamaError(
        `Model Ollama belum diunduh. Jalankan: ollama pull ${env.OLLAMA_MODEL}`,
        { stage: `http_${res.status}`, code: 'MODEL_NOT_FOUND', message: bodyText.slice(0, 300) }
      );
    }
    throw new OllamaError(`Ollama API error (http_${res.status})`, {
      stage: `http_${res.status}`,
      code: 'HTTP_ERROR',
      message: bodyText.slice(0, 300),
    });
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new OllamaError('Ollama API respons tidak valid (JSON tidak dapat di-parse)', {
      stage: 'parse',
      code: 'BAD_JSON',
      message: err.message,
    });
  }
  const content = String((data.message && data.message.content) || '').trim();
  if (!content) {
    throw new OllamaError('Ollama API respons kosong', { stage: 'parse', code: 'EMPTY_CONTENT' });
  }
  return { text: content };
}

/**
 * Parafrase satu chunk via Ollama. Prompt = buildParaphrasePrompt yang SAMA
 * dengan Gemini (instruksi konsisten antar provider).
 * @param {string} text satu chunk teks
 * @returns {Promise<{text: string}>}
 * @throws {OllamaError}
 */
async function paraphraseWithOllama(text) {
  const r = await callOllama({ prompt: buildParaphrasePrompt(String(text || '')) });
  return { text: r.text };
}

/**
 * Skor AI (0-100, 100 = pasti AI) via Ollama. Parse angka pertama dari jawaban.
 * @param {string} text
 * @returns {Promise<number>} skor 0-100
 * @throws {OllamaError} bila respons tanpa angka / gagal
 */
async function scoreWithOllama(text) {
  const r = await callOllama({ prompt: buildScorePrompt(String(text || '')) });
  const m = /\d{1,3}/.exec(r.text);
  if (!m) {
    throw new OllamaError('Ollama respons skor tidak valid (tidak ada angka)', {
      stage: 'parse',
      code: 'NO_NUMBER',
      message: r.text.slice(0, 120),
    });
  }
  return Math.max(0, Math.min(100, Number(m[0])));
}

/**
 * Cek server Ollama hidup (GET /api/tags, timeout 3s). TIDAK pernah throw.
 * @returns {Promise<boolean>}
 */
async function isOllamaAvailable() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.OLLAMA_URL}/api/tags`, { signal: controller.signal });
    if (!res.ok) return false;
    await res.json().catch(() => null);
    return true;
  } catch (err) {
    return false; // server mati / timeout — jangan crash, anggap tidak tersedia
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callOllama, paraphraseWithOllama, scoreWithOllama, isOllamaAvailable, OllamaError };
