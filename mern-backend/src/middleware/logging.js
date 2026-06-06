const morgan = require('morgan');
const logger = require('../utils/logger');

/**
 * Custom morgan token for response body size
 */
morgan.token('response-size', (req, res) => {
  const contentLength = res.get('content-length');
  return contentLength ? `${contentLength}b` : '-';
});

/**
 * Custom morgan format
 */
const morganFormat = ':method :url :status :response-time ms :response-size';

/**
 * Stream morgan output to winston logger
 */
const morganStream = {
  write: (message) => {
    const trimmed = message.trim();
    // Log 5xx as errors, everything else as info
    const statusMatch = trimmed.match(/\s(\d{3})\s/);
    if (statusMatch && parseInt(statusMatch[1], 10) >= 500) {
      logger.error(`HTTP ${trimmed}`);
    } else {
      logger.info(`HTTP ${trimmed}`);
    }
  },
};

/**
 * HTTP request logging middleware using morgan + winston
 */
const loggingMiddleware = morgan(morganFormat, {
  stream: morganStream,
  skip: (req) => {
    // Skip health check logs to reduce noise
    return req.url === '/api/health';
  },
});

module.exports = loggingMiddleware;
