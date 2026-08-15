/**
 * Plagiarism API — kontrak 04-backend-nodejs.md §8.3.
 * Upload: POST /api/plagiarism/upload (multipart field "file") → 202 {checkId}.
 * Hasil: GET /api/plagiarism/:id → polling 5s (processing → completed | failed).
 */
import http from './http';

export const plagiarismApi = {
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return http.post('/plagiarism/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (params) => http.get('/plagiarism', { params }),
  get: (id) => http.get(`/plagiarism/${id}`),
  getById: (id) => http.get(`/plagiarism/${id}`),
  /** URL PDF: window.open mengikuti redirect 302 tanpa masalah CORS. */
  previewPdfUrl: (id) => `/api/plagiarism/${id}/preview-pdf`,
  finalPdfUrl: (id) => `/api/plagiarism/${id}/final-pdf`,
};
