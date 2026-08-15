/**
 * Ekstraksi pesan error dari kontrak error backend:
 * { error: { code, message, details? } } (04-backend-nodejs.md §8.1).
 * Termasuk error 429 (rate limit → pesan backoff) & blob error (toolbox).
 */

export function extractErrorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (error?.userMessage) return error.userMessage;
  const data = error?.response?.data;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  if (error?.response?.status === 429)
    return 'Terlalu banyak permintaan — tunggu sebentar lalu coba lagi.';
  if (error?.message === 'Network Error')
    return 'Tidak dapat terhubung ke server. Periksa koneksi internetmu.';
  if (error?.message && typeof error.message === 'string' && error.message !== 'canceled')
    return error.message;
  return fallback;
}

/** Untuk error respons biner (toolbox): response.data berbentuk Blob JSON. */
export async function extractErrorMessageAsync(error, fallback = 'Terjadi kesalahan.') {
  const data = error?.response?.data;
  if (data instanceof Blob && data.type && data.type.includes('json')) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) return parsed.error.message;
      if (parsed?.message) return parsed.message;
    } catch {
      /* bukan JSON — lanjut fallback */
    }
  }
  return extractErrorMessage(error, fallback);
}

export function isRateLimited(error) {
  return error?.response?.status === 429;
}

/** 409 ALREADY_PAID — kontrak payment (03-ui-ux-design.md §6.1). */
export function isAlreadyPaid(error) {
  return (
    error?.response?.status === 409 &&
    error.response.data?.error?.code === 'ALREADY_PAID'
  );
}

export function isLockedPaid(error) {
  return error?.response?.status === 409 && error.response.data?.error?.code === 'LOCKED_PAID';
}

/**
 * 401 SESSION_REUSED — refresh cookie dipakai ulang di luar grace period /
 * token hasil logout (05-security §7, auth.controller REUSE). Artinya SESI
 * BENAR-BENAR DICABUT oleh server (seluruh keluarga) → jangan retry refresh.
 * Kebalikannya: 401 UNAUTHORIZED biasa dari /auth/refresh = RACE antar tab
 * (token kalah claim dalam grace 45s, sesi tetap hidup) → aman di-retry.
 */
export function isSessionReusedError(error) {
  return (
    error?.response?.status === 401 &&
    error.response.data?.error?.code === 'SESSION_REUSED'
  );
}
