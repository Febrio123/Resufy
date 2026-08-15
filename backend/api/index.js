/**
 * Vercel serverless adapter — titik masuk untuk fungsi serverless Vercel.
 *
 * KENAPA FILE INI ADA (keputusan fase 10 deploy):
 * - `src/server.js` memanggil `app.listen()` (proses panjang) — TIDAK boleh
 *   dipakai di Vercel (fungsi dibekukan setelah respons dikirim).
 * - Di sini kita export app Express apa adanya + memastikan koneksi MongoDB
 *   LAZY & DI-CACHE lintas warm invocation (cold start berikutnya tidak
 *   membuat koneksi baru).
 * - `vercel.json` (folder backend) men-rewrite `/(.*)` → `/api`, sehingga
 *   seluruh route app (yang ter-mount di `/api`) tetap jalan normal.
 * - JANGAN ubah logika bisnis apa pun — file ini hanya adapter + config.
 *   Seluruh route/controller/service di `src/` TIDAK disentuh.
 *
 * CATATAN KONNEKSI DB:
 * - `config/db.js` (connectMongo) memanggil `process.exit(1)` saat gagal di
 *   production — TIDAK boleh dipakai di serverless (mematikan lambda).
 * - Di sini koneksi dibuat sekali (module scope), cache promise, dan kegagalan
 *   TIDAK mematikan proses: health tetap melaporkan `db.disconnected`,
 *   endpoint stateless (preview PDF dsb) tetap bisa jalan.
 */
const mongoose = require('mongoose');
const app = require('../src/app');
const { env } = require('../src/config/env');

mongoose.set('strictQuery', true);

const MONGO_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let connPromise = null;

/** Pastikan terhubung ke MongoDB (lazy, di-cache). Tidak pernah throw fatal. */
async function ensureDb() {
  if (mongoose.connection.readyState === 1) return; // sudah connected
  if (!connPromise) {
    connPromise = mongoose
      .connect(env.MONGODB_URI, MONGO_OPTIONS)
      .catch((err) => {
        // Reset supaya invocation berikutnya mencoba lagi (bukan stuck).
        connPromise = null;
        // eslint-disable-next-line no-console
        console.error('[vercel-adapter] koneksi MongoDB gagal:', err.message);
        return null; // non-fatal: biarkan app menangani (health = disconnected)
      });
  }
  await connPromise;
}

/**
 * Handler serverless Vercel — jalankan koneksi lazy lalu serahkan ke app.
 * Catatan: `NODE_ENV=production` (set via `vercel env`) membuat app.js
 * mengaktifkan `trust proxy` (benar, karena di belakang proxy Vercel) dan
 * error handler menyembunyikan stack.
 */
module.exports = async function vercelHandler(req, res) {
  await ensureDb();
  return app(req, res);
};
