/**
 * Config module — satu-satunya tempat membaca process.env.
 * - dotenv dimuat dari .env di DALAM folder backend (backend/.env).
 * - Validasi Zod fail-fast: server menolak start jika env wajib tidak ada/format salah.
 * - JANGAN akses process.env langsung di file lain — import `env` dari sini.
 */
const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// .env berada di DALAM folder backend (backend/.env), 2 tingkat di atas config/
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z
  .object({
    // A. Umum / Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_ORIGIN: z.string().url('CLIENT_ORIGIN harus URL origin frontend (bukan *)'),
    API_PUBLIC_URL: z.string().url('API_PUBLIC_URL harus URL publik backend'),

    // B. Database
    MONGODB_URI: z.string().min(1, 'MONGODB_URI wajib diisi'),

    // C. Autentikasi (JWT httpOnly cookie — asumsi provisional, divalidasi fase 05)
    JWT_SECRET: z.string().min(20, 'JWT_SECRET minimal 20 karakter (disarankan >=32)'),
    // Secret refresh token TERPISAH (gap skill jwt-authentication): refresh JWT
    // ditandatangani secret berbeda — kompromi access secret tidak menyentuh refresh.
    JWT_REFRESH_SECRET: z.string().min(20, 'JWT_REFRESH_SECRET minimal 20 karakter'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_COOKIE_SECURE: booleanFromString,
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

    // D. Cloudinary
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    CLOUDINARY_FOLDER_PREFIX: z.string().default('resufy/'),

    // E. Midtrans (pay-per-print Rp2.000)
    MIDTRANS_SERVER_KEY: z.string().min(1),
    MIDTRANS_CLIENT_KEY: z.string().min(1),
    MIDTRANS_IS_PRODUCTION: booleanFromString,
    MIDTRANS_SNAP_BASE_URL: z
      .string()
      .url()
      .default('https://app.sandbox.midtrans.com/snap/v1/transactions'),
    MIDTRANS_MERCHANT_ID: z.string().optional().default(''),

    // F. Web Search API — SerpApi (keputusan fase 4 kickoff)
    SERPAPI_API_KEY: z.string().min(1, 'SERPAPI_API_KEY wajib diisi (modul plagiarism)'),
    SERPAPI_GL: z.string().default('id'),
    SERPAPI_HL: z.string().default('id'),

    // G. Email / SMTP — reset password (keputusan tertunda; user sudah mengisi SMTP_*)
    SMTP_HOST: z.string().optional().default(''),
    SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    EMAIL_FROM: z.string().optional().default(''),

    // H. Opsional / utilitas
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error'])
      .default('info'),

    // I. AI Content Detector — Gemini (opsional; tanpa key → heuristik lokal)
    // CATATAN 2026-08: gemini-2.5-flash TIDAK lagi tersedia utk pengguna baru
    // (404 "no longer available to new users") → daftar CSV model stabil,
    // dipakai berurutan saat 429/5xx/timeout ("high demand" sering temporer).
    GEMINI_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL: z.string().default('gemini-3.7-flash,gemini-flash-latest,gemini-3.6-flash'),

    // J. Fallback LLM lokal — Ollama (gratis, offline, TANPA kunci API).
    // Dipakai OTOMATIS oleh paraphraser (toolbox) saat Gemini gagal
    // (429 quota/5xx/timeout/tanpa kunci) — fitur tetap jalan di CPU lokal.
    OLLAMA_URL: z.string().url('OLLAMA_URL harus URL valid (contoh http://127.0.0.1:11434)').default('http://127.0.0.1:11434'),
    // Model default qwen2.5:3b (multibahasa, ringan utk CPU). Alternatif:
    // gemma3:4b, llama3.2:3b. Unduh: `ollama pull <model>`.
    OLLAMA_MODEL: z.string().default('qwen2.5:3b'),
    // Model CPU lambat & first-load lambat → timeout panjang (default 120 detik).
    OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  })
  // Key tambahan milik user (mis. CLOUDINARY_UPLOAD_*) dibiarkan lolos
  .passthrough();

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ [config/env] Environment variable tidak valid:');
  for (const issue of parsed.error.issues) {
    // Zod tidak menampilkan nilai, hanya path & pesan — aman untuk log
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('Periksa file .env di dalam folder backend (backend/.env; lihat template di .env.example root project). Server berhenti (fail-fast).');
  process.exit(1);
}

const env = parsed.data;

// Warning non-fatal (tidak menghentikan start):
if (env.NODE_ENV === 'production' && env.JWT_COOKIE_SECURE === false) {
  console.warn('⚠️ [config/env] NODE_ENV=production tapi JWT_COOKIE_SECURE=false — cookie tidak aman di prod.');
}
if (env.NODE_ENV === 'production' && env.MIDTRANS_IS_PRODUCTION === false) {
  console.warn('⚠️ [config/env] NODE_ENV=production tapi MIDTRANS_IS_PRODUCTION=false — pembayaran masih SANDBOX.');
}
if (env.JWT_SECRET.length < 32) {
  console.warn('⚠️ [config/env] JWT_SECRET < 32 karakter — sebaiknya regenerate dengan secret lebih kuat.');
}
if (/\s/.test(env.JWT_SECRET)) {
  console.warn('⚠️ [config/env] JWT_SECRET mengandung spasi — berfungsi, tapi sebaiknya diganti tanpa spasi (instruksi: jangan diubah sendiri, kabari orchestrator).');
}

/** Durasi string ('15m', '7d', '12h') → milidetik. Fallback 0 bila tidak dikenali. */
function durationToMs(dur) {
  const m = /^(\d+)(s|m|h|d)$/.exec(String(dur || ''));
  if (!m) return 0;
  const mult = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return Number(m[1]) * mult[m[2]];
}

const jwtCookieMaxAgeMs = durationToMs(env.JWT_ACCESS_EXPIRES_IN) || (15 * 60 * 1000);
const refreshCookieMaxAgeMs = durationToMs(env.REFRESH_TOKEN_EXPIRES_IN) || (7 * 24 * 60 * 60 * 1000);

const AUTH_COOKIE_NAME = 'resufy_token';
// Refresh cookie — httpOnly, path '/api/auth' (hanya dikirim ke endpoint
// refresh/logout; TIDAK dibaca middleware auth untuk endpoint lain).
const REFRESH_COOKIE_NAME = 'resufy_refresh';
// CSRF cookie (double-submit token) — TIDAK httpOnly (JS frontend baca utk header).
// SameSite=Lax dikunci bersama cookie auth (redirect balik Snap Midtrans butuh Lax).
const CSRF_COOKIE_NAME = 'resufy_csrf';
const PRICE_AMOUNT_IDR = 2000; // Rp2.000 per cetak PDF (keputusan final requirement)

module.exports = {
  env,
  jwtCookieMaxAgeMs,
  refreshCookieMaxAgeMs,
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  PRICE_AMOUNT_IDR,
};
