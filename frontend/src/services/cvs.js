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
  previewPdf: (payload) =>
    http.post('/cvs/preview-pdf', payload && payload.content ? payload : { content: payload }, { responseType: 'blob', timeout: 60000 }),
  duplicate: (id) => http.post(`/cvs/${id}/duplicate`),
  /** ATS score GRATIS; jobDescription opsional untuk keyword match. */
  runAts: (id, { jobDescription } = {}) =>
    http.post(`/cvs/${id}/ats-score`, jobDescription ? { jobDescription } : {}),
  /** URL PDF langsung stream: dibuka di browser / Adobe Acrobat tanpa lewat Cloudinary */
  previewPdfUrl: (id) => `/api/cvs/${id}/preview-pdf`,
  finalPdfUrl: (id) => `/api/cvs/${id}/final-pdf`,
  downloadPdfUrl: (id) => `/api/cvs/${id}/preview-pdf?download=1`,

  // Photo endpoints (kontrak 04-backend-nodejs.md §5)
  /**
   * Upload foto 3x4 — multipart/form-data.
   * Response: { photoUrl, photoCrop: {x:0, y:0, width:1, height:1} }
   */
  uploadPhoto: (id, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return http.post(`/cvs/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  /**
   * Update crop coordinates — normalized 0-1.
   * Body: { photoCrop: { x, y, width, height } }
   * Response: { cv: {...} }
   */
  updatePhotoCrop: (id, photoCrop) =>
    http.put(`/cvs/${id}/photo-crop`, { photoCrop }),
  /**
   * Delete foto — hapus file Cloudinary + clear photoUrl/photoCrop.
   * Response: { success: true }
   */
  deletePhoto: (id) => http.delete(`/cvs/${id}/photo`),
};
