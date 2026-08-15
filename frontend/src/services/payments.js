/**
 * Payment API — kontrak 04-backend-nodejs.md §8.3/§9.2.
 * - POST /api/payments {itemType, itemId} → 201 {snapToken,...} | 409 ALREADY_PAID
 * - GET /api/payments/:id/status → polling 5s {status, finalPdfUrl}
 * - GET /api/payments → riwayat transaksi (invoice)
 */
import http from './http';

export const paymentsApi = {
  create: ({ itemType, itemId }) => http.post('/payments', { itemType, itemId }),
  list: (params) => http.get('/payments', { params }),
  get: (id) => http.get(`/payments/${id}`),
  status: (id) => http.get(`/payments/${id}/status`),
};
