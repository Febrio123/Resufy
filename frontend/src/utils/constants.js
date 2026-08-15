/**
 * Konstanta bisnis & copy baku lintas fase (03-ui-ux-design.md §6.5, decisions-log).
 * Harga final Rp2.000; Toolbox 100% gratis; polling 5s tanpa WebSocket.
 */

export const PRICE_AMOUNT_IDR = 2000;
export const PRICE_LABEL = 'Rp2.000'; // format baku: tanpa spasi

/** Copy baku yang dipakai konsisten di seluruh UI */
export const COPY = {
  previewWatermark: 'PREVIEW — BERWATERMARK',
  downloadPreview: 'Unduh PDF Preview — Gratis',
  downloadHq: 'Unduh PDF HQ — Rp2.000',
  downloadFinal: 'Unduh PDF Final',
  downloadLaporanPreview: 'Unduh Laporan Preview — Gratis',
  downloadLaporanHq: 'Unduh Laporan HQ — Rp2.000',
  downloadLaporanFinal: 'Unduh Laporan Final',
  continuePay: 'Lanjut Bayar',
  paidForever: 'Sudah dibayar — unduh gratis selamanya',
  onceOnly: 'sekali bayar, tanpa langganan',
  paymentMethods: 'QRIS / Virtual Account / GoPay / ShopeePay',
  searchCostNotice:
    'Pemeriksaan membandingkan dokumen dengan sumber internet. Biaya pencarian web ditanggung sistem — kamu tidak dikenakan biaya tambahan untuk melihat hasil di layar.',
};

/** Upload plagiarism: tipe & ekstensi yang diizinkan backend (multer + magic bytes) */
export const PLAGIARISM_ACCEPT = {
  accept: '.pdf,.docx,.doc,.txt',
  label: 'PDF, DOCX, DOC, TXT',
  maxSize: 10 * 1024 * 1024, // 10 MB (backend multer)
};

/** Polling payment & plagiarism (keputusan lintas fase: 5 detik, tanpa WebSocket) */
export const POLL_INTERVAL_MS = 5000;
export const POLL_MAX_ATTEMPTS = 60; // ±5 menit, lalu berhenti + cek manual

/** Template CV yang didukung backend (hardcode config, bukan koleksi DB) */
export const CV_TEMPLATES = [
  {
    id: 'ats-single-column',
    name: 'ATS Single Column',
    description: 'Satu kolom, text-based — paling aman untuk parser ATS.',
    recommended: true,
  },
];
