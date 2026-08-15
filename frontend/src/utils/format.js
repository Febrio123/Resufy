/**
 * Format harga & tanggal — konsistensi lintas fase (03-ui-ux-design.md §6.5).
 * - UI umum: "Rp2.000" (tanpa spasi).
 * - Invoice/tabel transaksi: "IDR 2.000" via Intl id-ID.
 */

export function formatPrice(amount = 2000) {
  return `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;
}

export function formatIdr(amount = 2000) {
  return `IDR ${new Intl.NumberFormat('id-ID').format(amount)}`;
}

export function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '-';
  }
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '-';
  }
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatDate(iso);
}

export function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Tone semantik skor ATS: tinggi = bagus (hijau). */
export function atsTone(score) {
  if (score === null || score === undefined) return { tone: 'muted', label: 'Belum dicek' };
  if (score >= 80) return { tone: 'success', label: 'Bagus' };
  if (score >= 60) return { tone: 'warning', label: 'Cukup' };
  return { tone: 'destructive', label: 'Perlu diperbaiki' };
}

/** Tone semantik skor similarity: tinggi = buruk (merah) — konsisten §5.1. */
export function similarityTone(score) {
  if (score === null || score === undefined) return { tone: 'muted', label: 'Belum ada skor' };
  if (score < 30) return { tone: 'success', label: 'Rendah' };
  if (score < 60) return { tone: 'warning', label: 'Sedang' };
  return { tone: 'destructive', label: 'Tinggi' };
}
