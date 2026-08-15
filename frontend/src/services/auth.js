/** Auth API — kontrak 04-backend-nodejs.md §8.3/§9.2 + 05-security.md §7. */
import http from './http';

export const authApi = {
  getCsrf: () => http.get('/auth/csrf'),
  register: (payload) => http.post('/auth/register', payload),
  login: (payload) => http.post('/auth/login', payload),
  logout: () => http.post('/auth/logout'),
  me: () => http.get('/auth/me'),
  // NOTE: refresh TIDAK ada di sini — SEMUA panggilan refresh lewat
  // refreshSessionOnce() di services/http.js (singleton serial, satu jalur).
  forgotPassword: (email) => http.post('/auth/forgot-password', { email }),
  resetPassword: ({ token, password }) => http.post('/auth/reset-password', { token, password }),
};
