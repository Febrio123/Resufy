/**
 * Health controller — probe sederhana untuk liveness + status koneksi DB.
 * Dipakai fase deployment (orchestrator/healthcheck) & fase testing.
 */
const { isDbConnected } = require('../config/db');
const { env } = require('../config/env');
const pkg = require('../../package.json');

const health = async (req, res) => {
  res.json({
    status: 'ok',
    service: pkg.name || 'resufy-api',
    version: pkg.version || '0.0.0',
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    db: { connected: isDbConnected() },
  });
};

module.exports = { health };
