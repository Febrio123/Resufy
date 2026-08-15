/**
 * Server entry — boot, recovery job mati, graceful shutdown.
 * Catatan keputusan: koneksi DB NON-BLOCKING di development (server tetap
 * listen walau DB belum siap — health report menunjukkan status); di production
 * kegagalan DB = exit (fail-fast). Job similarity stale > 10 menit di-recover
 * saat boot.
 */
const app = require('./app');
const { env } = require('./config/env');
const { logger } = require('./config/logger');
const { connectMongo, disconnectMongo } = require('./config/db');
const { similarityService } = require('./services/index');

async function start() {
  await connectMongo(); // non-blocking di dev, exit di prod (lihat config/db.js)

  // Recovery: plagiarism check yang "processing" > 10 menit → failed
  similarityService.recoverStaleJobs().catch((err) => {
    logger.warn({ err }, '[server] recovery stale jobs gagal (diabaikan)');
  });

  const server = app.listen(env.PORT, () => {
    logger.info(`resufy-api listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    logger.info(`[server] ${signal} diterima — shutdown graceful...`);
    server.close(async () => {
      await disconnectMongo();
      process.exit(0);
    });
    // Paksa keluar bila koneksi macet (webhook/request menggantung)
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // Fail-fast: rejection yang tak tertangani = state tak tentu. Log + exit
  // (konsisten dengan default Node ≥15; semua async fire-and-forget internal
  // sudah punya .catch sendiri — lihat similarityService/similarity recovery).
  process.on('unhandledRejection', (err) => {
    logger.fatal({ err }, '[server] unhandledRejection — proses dihentikan');
    process.exit(1);
  });
}

start().catch((err) => {
  logger.fatal({ err }, '[server] gagal start');
  process.exit(1);
});
