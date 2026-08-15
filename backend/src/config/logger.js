/** Pino structured logger + pino-http untuk request logging. */
const pino = require('pino');
const pinoHttp = require('pino-http');
const { env } = require('./env');

const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'resufy-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
});

const httpLogger = pinoHttp({
  logger,
  autoLogging: env.NODE_ENV !== 'test',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
});

module.exports = { logger, httpLogger };
