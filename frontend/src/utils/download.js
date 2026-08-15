/**
 * Utilitas unduhan blob (toolbox & lainnya).
 * Dipisah dari service layer supaya TIDAK terjadi circular import:
 * `services/toolbox.js` → `utils/download.js` (satu arah saja).
 */

/** Parse nama file dari Content-Disposition (filename* UTF-8 → fallback). */
export function filenameFromDisposition(header, fallback = 'resufy_output') {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/^"|"$/g, ''));
    } catch {
      /* fallback ke plain */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].replace(/^"|"$/g, '') : fallback;
}

/**
 * Simpan blob (axios response `{ data: Blob, headers }`) ke perangkat user
 * lewat elemen <a download> + object URL, lalu revoke setelah browser mulai
 * mengunduh. Return nama file (dari Content-Disposition atau fallback) agar
 * caller bisa menampilkannya di UI (toast/label sukses).
 * Guard: `response.data` bukan Blob → lempar error jelas; caller menangkapnya
 * via extractErrorMessage (error.message generik tetap dirender ke toast).
 */
export function downloadBlob(response, fallbackName = 'resufy_output') {
  if (!response?.data || typeof Blob === 'undefined' || !(response.data instanceof Blob)) {
    throw new Error('Hasil unduhan tidak valid — coba lagi.');
  }
  const filename = filenameFromDisposition(
    response.headers?.['content-disposition'],
    fallbackName,
  );
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  // Perlu di-append ke DOM (sementara) agar klik terdaftar di Firefox;
  // elemen langsung dibuang setelahnya.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Beri waktu browser memulai unduhan sebelum melepas object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
