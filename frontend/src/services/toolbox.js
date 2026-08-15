/**
 * Toolbox API — 100% GRATIS, boleh anonymous (keputusan lintas fase).
 * Endpoint: /api/toolbox/compress | paraphrase | ai-check
 * - compress: field `mode` ('standard' | 'hard' | 'ekstrem', default 'standard')
 * - paraphrase: body JSON { text } (50–100.000 karakter) → respons JSON
 *   { aiScoreBefore, aiScoreAfter, iterations, paraphrasedText, provider }
 * - ai-check: field `text` (opsional) + `file` (opsional PDF/DOCX/TXT/DOC;
 *   minimal satu wajib) → respons JSON (BUKAN blob).
 * Endpoint binary (compress) → blob + header Content-Disposition utk
 * nama file: lihat utils/download.js.
 */
import http from './http';
import { downloadBlob } from '../utils/download';

async function postBinary(path, { file, fields = {} }) {
  const form = new FormData();
  form.append('file', file);
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, value);
  });
  return http.post(`/toolbox/${path}`, form, {
    responseType: 'blob',
    timeout: 120000, // proses server bisa beberapa detik
  });
}

export const toolboxApi = {
  compress: (file, { mode = 'standard' } = {}) => postBinary('compress', { file, fields: { mode } }),

  /**
   * Parafrase AI (teks) — body JSON { text } → respons JSON
   * { aiScoreBefore, aiScoreAfter, iterations, paraphrasedText } (skor & hasil
   * ada di BODY, bukan header). Error 422/503/502 datang sebagai JSON biasa →
   * pemanggil cukup pakai extractErrorMessage. Timeout panjang: parafrase teks
   * hingga 100.000 karakter bisa butuh beberapa detik.
   */
  async paraphrase(text) {
    const response = await http.post(
      '/toolbox/paraphrase',
      { text },
      { timeout: 120000 }
    );
    return response.data;
  },

  /**
   * AI Content Detector — teks/file opsional (minimal satu wajib).
   * Respons JSON (BUKAN blob) → http default responseType json, return response.data.
   */
  async aiCheck({ text = '', file = null } = {}) {
    const form = new FormData();
    if (text) form.append('text', text);
    if (file) form.append('file', file);
    const response = await http.post('/toolbox/ai-check', form);
    return response.data;
  },

  /** Dispatcher umum: map key tool → endpoint + parameter opsional (ToolDetailPage). */
  run(tool, input, params = {}) {
    switch (tool) {
      case 'compress':
        return this.compress(input, { mode: params.mode || 'standard' });
      case 'paraphrase':
        return this.paraphrase(input);
      default:
        throw new Error(`Tool tidak dikenal: ${tool}`);
    }
  },

  /** Unduh blob hasil toolbox ke perangkat user; return nama file. */
  download(response, fallbackName) {
    return downloadBlob(response, fallbackName);
  },

  /** Unduh blob + nama file LANGKAH (mis. hasil parafrase — header X-Result-Filename). */
  downloadBlobNamed(blob, filename) {
    return downloadBlob(
      { data: blob, headers: { 'content-disposition': `attachment; filename="${filename}"` } },
      filename
    );
  },
};
