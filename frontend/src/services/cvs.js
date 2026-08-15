/** CV Builder API — kontrak 04-backend-nodejs.md §8.3. Path FINAL: /api/cvs. */
import http from './http';

export const cvsApi = {
  list: (params) => http.get('/cvs', { params }),
  get: (id) => http.get(`/cvs/${id}`),
  getById: (id) => http.get(`/cvs/${id}`),
  create: (payload) => http.post('/cvs', payload),
  update: (id, payload) => http.put(`/cvs/${id}`, payload),
  remove: (id) => http.delete(`/cvs/${id}`),
  /** Alias eksplisit — soft delete; 200 { message: "CV berhasil dihapus." } */
  deleteCv: (id) => http.delete(`/cvs/${id}`),
  /**
   * Preview PDF STATELESS SEBELUM simpan — POST body { content } → blob
   * application/pdf ber-watermark. Tidak menyimpan apa pun di backend.
   * (Kontrak: 422 INVALID_CONTENT | 500 PDF_GENERATION_FAILED.)
   */
  previewPdf: (content) =>
    http.post('/cvs/preview-pdf', { content }, { responseType: 'blob', timeout: 60000 }),
  duplicate: (id) => http.post(`/cvs/${id}/duplicate`),
  /** ATS score GRATIS; jobDescription opsional untuk keyword match. */
  runAts: (id, { jobDescription } = {}) =>
    http.post(`/cvs/${id}/ats-score`, jobDescription ? { jobDescription } : {}),
  /** URL PDF: window.open mengikuti redirect 302 tanpa masalah CORS. */
  previewPdfUrl: (id) => `/api/cvs/${id}/preview-pdf`,
  finalPdfUrl: (id) => `/api/cvs/${id}/final-pdf`,
};
