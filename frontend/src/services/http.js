/**
 * Axios instance + interceptor keamanan (05-security.md §7 — WAJIB):
 *  - withCredentials: true → kirim cookie httpOnly `resufy_token`.
 *  - Header `X-CSRF-Token` di SEMUA mutasi ke /cvs, /plagiarism, /payments.
 *  - 401 (access 15m kedaluwarsa) pada endpoint NON-auth → AUTO-REFRESH:
 *    POST /api/auth/refresh (single-use/rotating → dieksekusi SERIAL via
 *    promise singleton; request 401 lain menunggu hasil yang sama) → retry
 *    request asli (flag `_retry`, tanpa infinite loop).
 *  - Refresh gagal (syarat akhiri sesi via sessionEndedHandler):
 *      * 401 SESSION_REUSED → reuse asli → sesi DICABUT server → langsung akhiri.
 *      * 401 UNAUTHORIZED biasa → RACE antar tab (token kalah claim dalam grace
 *        45s, sesi tetap hidup; cookie refresh baru sudah di-set tab pemenang di
 *        browser) → tunggu ~400ms lalu retry refresh SEKALI; masih gagal → akhiri.
 *      * Non-401 (network/5xx) → sesi tidak pasti → akhiri (perilaku existing).
 *    Maks 2 percobaan refresh per burst (counter lokal) + cooldown 5s global.
 *  - 429 → tandai error + pesan backoff.
 * Token CSRF disimpan di MEMORY (bukan localStorage) — di-set AuthContext.
 */

import axios from 'axios';
import { isSessionReusedError } from '../utils/errors';

/**
 * baseURL: pakai VITE_API_URL HANYA bila benar-benar menunjuk host lain —
 * mengabaikan nilai yang menunjuk localhost (mis. `http://localhost:4112`
 * yang tak sengaja terset di env production Vercel → browser pengguna
 * memanggil localhost sendiri → CORS error). Di production pakai relative
 * '/api' → di-rewrite vercel.json ke backend. Di dev, VITE_API_URL yang
 * benar (host non-localhost) tetap dipakai apa adanya.
 */
const apiBaseUrl =
  import.meta.env.VITE_API_URL &&
  !/^(http:\/\/)?(localhost|127\.0\.0\.1)/.test(import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : '/api';

const http = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true, // cookie httpOnly (05-security.md §7)
  timeout: 30000,
});

let csrfToken = null;
let sessionEndedHandler = null;

/** Promise refresh singleton — menjamin refresh berjalan satu-per-satu. */
let refreshPromise = null;
/** Anti loop: jangan coba refresh lagi beberapa detik setelah percobaan terakhir. */
let lastRefreshAttemptAt = 0;
let lastSessionEndedAt = 0;
const REFRESH_COOLDOWN_MS = 5000;

export function setCsrfToken(token) {
  csrfToken = token || null;
}

/** Didaftarkan AuthContext — dipanggil saat refresh gagal (sesi mati). */
export function setSessionEndedHandler(handler) {
  sessionEndedHandler = handler || null;
}

/**
 * Segarkan sesi (rotasi access + refresh cookie) — dipakai sebelum `window.open`
 * PDF. Lewat `refreshSessionOnce()` (singleton): dua klik unduh / panggilan
 * bersamaan menunggu HASIL YANG SAMA (satu rotasi, bukan dua). Kalau refresh
 * gagal → error mengalir ke pemanggil (window.open TIDAK dijalankan).
 */
export async function ensureFreshSession() {
  await refreshSessionOnce();
}

/** Prefix route yang dilindungi csrfProtect di backend (05-security.md §2.2). */
const CSRF_GUARDED_PREFIXES = ['/cvs', '/plagiarism', '/payments'];
const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

http.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';
  const needsCsrf =
    MUTATION_METHODS.has(method) &&
    CSRF_GUARDED_PREFIXES.some((prefix) => url.startsWith(prefix));
  if (needsCsrf && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

/**
 * Jalankan refresh SEKALI; semua pemanggil menunggu promise yang sama.
 * SATU-SATUNYA jalur panggilan `POST /auth/refresh` di frontend (sentralisasi:
 * interceptor 401, ensureFreshSession PDF, boot AuthContext) — menjamin refresh
 * rotating single-use TIDAK pernah dipanggil paralel dengan token yang sama
 * dalam satu tab (mencegah rotasi berantai / cookie refresh hilang-muncul).
 * Catatan: TIDAK menambah header CSRF (url `/auth/refresh` bukan di
 * CSRF_GUARDED_PREFIXES) — konsisten, sengaja.
 */
export function refreshSessionOnce() {
  if (!refreshPromise) {
    refreshPromise = http.post('/auth/refresh').finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Akhiri sesi lokal sekali per burst (guard 5s) — idempotent. */
function endSessionQuietly(error) {
  const now = Date.now();
  if (now - lastSessionEndedAt > REFRESH_COOLDOWN_MS && sessionEndedHandler) {
    lastSessionEndedAt = now;
    sessionEndedHandler(error);
  }
}

/** Delay kecil sebelum retry refresh race — biarkan tab pemenang menimpa cookie. */
const RETRY_DELAY_MS = 400;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Refresh dengan retry SEKALI untuk race multi-tab (kontrak backend §auth.controller):
 *  - 401 SESSION_REUSED → reuse asli di luar grace → sesi dicabut → langsung lempar
 *    (tanpa retry). Pemanggil akan mengakhiri sesi.
 *  - 401 UNAUTHORIZED biasa → race antar tab (sesi tetap hidup, cookie baru sudah
 *    di-set tab pemenang di browser yang sama) → tunggu RETRY_DELAY_MS lalu coba
 *    refresh SEKALI lagi. Masih gagal → lempar error terminal.
 *  - Non-401 (network/5xx) → lempar langsung (tidak ada gunanya retry).
 * Maks 2 percobaan per burst (counter lokal `attempts`); cooldown 5s global tetap
 * mengunci PERCOBAAN PERTAMA burst baru — retry kedua sengaja dilewati cooldown
 * karena masih bagian dari burst yang sama. Request asli hanya di-retry setelah
 * refresh sukses (via `return http(config)`).
 */
async function refreshForRequest(config, originalError) {
  let attempts = 0;

  const tryRefresh = async () => {
    attempts += 1;
    if (refreshPromise) {
      // Ada refresh sedang berjalan (burst 401 dalam tab yang sama) → ikut hasil
      // yang sama, tanpa memanggil refresh lagi (refresh single-use/rotating).
      await refreshPromise;
      return;
    }
    if (attempts === 1 && Date.now() - lastRefreshAttemptAt <= REFRESH_COOLDOWN_MS) {
      // Refresh baru saja terjadi (cooldown 5s) → biarkan error asli mengalir ke
      // jalur retry (percobaan kedua tetap diizinkan — masih burst yang sama).
      throw originalError;
    }
    lastRefreshAttemptAt = Date.now();
    await refreshSessionOnce();
  };

  try {
    await tryRefresh(); // percobaan 1
  } catch (err1) {
    if (isSessionReusedError(err1) || err1?.response?.status !== 401) throw err1;
    // 401 biasa = race antar tab → tunggu tab pemenang menimpa cookie, retry sekali
    await wait(RETRY_DELAY_MS);
    await tryRefresh(); // percobaan 2 — error propagasi ke pemanggil bila gagal
  }
  // Refresh sukses → cookie access baru sudah di-set browser → retry request asli.
  return http(config);
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const config = error.config || {};

    if (status === 429) {
      error.userMessage = 'Terlalu banyak permintaan — tunggu sebentar lalu coba lagi.';
      error.isRateLimited = true;
      return Promise.reject(error);
    }

    // 403 CSRF_ERROR (double-submit: header tidak cocok / cookie `resufy_csrf`
    // hilang-EXPIRED di browser) → token baru via GET /api/auth/csrf (server
    // set cookie baru + body csrfToken) lalu retry request SEKALI. Menutup
    // kasus residual (mis. cookie CSRF expired di tab lama — bug backend 15m
    // sudah diperbaiki; cookie dihapus manual; token memory stale) TANPA perlu
    // refresh manual browser (laporan user: "terkadang token CSRF tidak dibuat").
    const isCsrfError = status === 403 && error.response?.data?.error?.code === 'CSRF_ERROR';
    if (isCsrfError && !config._csrfRetry) {
      config._csrfRetry = true;
      try {
        const csrfRes = await http.get('/auth/csrf');
        setCsrfToken(csrfRes.data.csrfToken);
        return http(config); // retry request asli — cookie + header baru
      } catch (csrfErr) {
        return Promise.reject(csrfErr);
      }
    }

    // 401 di endpoint /auth/* (login salah, refresh gagal, me) = normal —
    // JANGAN memicu auto-refresh di sini (hindari loop refresh).
    const isAuthUrl = url.startsWith('/auth');

    if (status === 401 && !isAuthUrl && !config._retry) {
      config._retry = true;
      try {
        return await refreshForRequest(config, error);
      } catch (refreshError) {
        // Sampai sini HANYA jika: SESSION_REUSED, non-401, atau retry kedua gagal.
        endSessionQuietly(refreshError);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default http;
