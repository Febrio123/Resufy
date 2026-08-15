/**
 * Express app — middleware chain & route mount.
 * Urutan penting: helmet → cors (credentials) → compression → pino-http →
 * body parser → cookie parser → global rate limit → /api routes → 404 →
 * central error handler.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { env } = require('./config/env');
const { httpLogger } = require('./config/logger');
const { createRateLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes');
const { notFound } = require('./middlewares/notFound');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.disable('x-powered-by');
// trust proxy HANYA di production (di belakang reverse proxy): di dev, klien
// langsung bisa memalsukan X-Forwarded-For dan mem-bypass rate limit kalau
// proxy dipercaya tanpa syarat.
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet());

// CORS — single origin dari env; credentials=true (cookie JWT)
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));

// Kompresi respons (JSON API)
app.use(compression());

// Request logging (pino-http)
app.use(httpLogger);

// Body parser — JSON (bukan raw; Midtrans webhook kirim JSON biasa)
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Rate limit GLOBAL (fallback) — skip /api/health agar probe tidak kena limit.
// Catatan: di dalam middleware yang di-mount dengan prefix '/api', req.path
// relatif terhadap prefix ('/health' untuk GET /api/health).
const globalLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  skip: (req) => req.path === '/health',
});
app.use('/api', globalLimiter);

// Routes
app.use('/api', routes);

// 404 + error handler (harus PALING AKHIR)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
