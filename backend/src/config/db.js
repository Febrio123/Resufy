/**
 * Mongoose connection — best practices:
 * - maxPoolSize & serverSelectionTimeoutMS eksplisit
 * - connection events untuk observability
 * - connectMongo() TIDAK melempar ke atas: kalau gagal di development, server tetap
 *   listen (health check melaporkan db: disconnected). Di production, gagal = exit.
 */
const mongoose = require('mongoose');
const { env } = require('./env');

mongoose.set('strictQuery', true);

const mongoOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000, // gagal cepat kalau Atlas tidak reachable
  socketTimeoutMS: 45000,
};

async function connectMongo() {
  mongoose.connection.on('connected', () => {
    console.log('🔌 [db] MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('🔌 [db] MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('🔌 [db] MongoDB disconnected');
  });

  try {
    await mongoose.connect(env.MONGODB_URI, mongoOptions);
    return true;
  } catch (err) {
    console.error('❌ [db] Gagal konek MongoDB:', err.message);
    if (env.NODE_ENV === 'production') {
      console.error('Production: keluar karena DB tidak tersedia.');
      process.exit(1);
    }
    console.warn('⚠️ [db] Development: server tetap start, /api/health akan melaporkan db disconnected.');
    return false;
  }
}

async function disconnectMongo() {
  await mongoose.disconnect();
}

function isDbConnected() {
  return mongoose.connection.readyState === 1; // 1 = connected
}

module.exports = { connectMongo, disconnectMongo, isDbConnected };
