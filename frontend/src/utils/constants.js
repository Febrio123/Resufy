/**
 * Konstanta bisnis & copy baku lintas fase (model bisnis gratis penuh).
 * Toolbox 100% gratis; polling 5s tanpa WebSocket.
 */

/** Copy baku yang dipakai konsisten di seluruh UI */
export const COPY = {
  previewWatermark: 'PREVIEW — BERWATERMARK',
  downloadPreview: 'Unduh PDF Preview — Gratis',
  downloadFinal: 'Unduh PDF',
  downloadLaporanPreview: 'Unduh Laporan Preview — Gratis',
  downloadLaporanFinal: 'Unduh Laporan PDF',
  paidForever: 'Unduh gratis selamanya',
  searchCostNotice:
    'Pemeriksaan membandingkan dokumen dengan sumber internet — gratis 100%.',
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
