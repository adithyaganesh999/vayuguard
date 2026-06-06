require('dotenv').config();
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // ─── MongoDB Connection (optional — graceful fallback) ────────────────
    let mongoConnected = false;
    let redisClient = null;

    try {
      const mongoose = require('mongoose');
      const { MONGODB_URI, MONGODB_OPTIONS } = require('./config/db');
      logger.info('[Server] Connecting to MongoDB...');
      await mongoose.connect(MONGODB_URI, MONGODB_OPTIONS);
      mongoConnected = true;
      logger.info('[Server] MongoDB connected successfully');
    } catch (mongoErr) {
      logger.warn('[Server] MongoDB not available — running in STANDALONE mode (no database)');
      logger.warn('[Server] Some features requiring database will return mock/demo data');
      logger.warn(`[Server] MongoDB error: ${mongoErr.message}`);
    }

    // ─── Redis Connection (optional) ─────────────────────────────────────
    if (mongoConnected) {
      try {
        const { connectRedis } = require('./config/redis');
        redisClient = await connectRedis();
        if (redisClient) {
          logger.info('[Server] Redis connected successfully');
        } else {
          logger.warn('[Server] Redis not available — using in-memory fallback');
        }
      } catch (redisErr) {
        logger.warn('[Server] Redis connection failed — using in-memory fallback');
      }
    }

    // ─── Alert Scheduler (only with MongoDB) ─────────────────────────────
    if (mongoConnected) {
      try {
        const { initAlertScheduler } = require('./services/alertScheduler');
        initAlertScheduler();
        logger.info('[Server] Alert scheduler initialized');
      } catch (err) {
        logger.warn('[Server] Alert scheduler not available');
      }
    }

    // ─── Create HTTP Server ──────────────────────────────────────────────
    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`[Server] VayuGuard API running on port ${PORT}`);
      logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`[Server] Mode: ${mongoConnected ? 'FULL (with database)' : 'STANDALONE (mock data)'}`);
      logger.info(`[Server] Health check: http://localhost:${PORT}/api/health`);
      if (!mongoConnected) {
        logger.info('');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('  Running in STANDALONE mode (no MongoDB/Redis)');
        logger.info('  To enable full mode, start MongoDB and Redis:');
        logger.info('    Option 1: Install MongoDB locally');
        logger.info('    Option 2: Use Docker: docker compose up mongodb redis');
        logger.info('═══════════════════════════════════════════════════════');
      }
    });

    // ─── Graceful Shutdown ───────────────────────────────────────────────
    const shutdown = async (signal) => {
      logger.info(`[Server] ${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        logger.info('[Server] HTTP server closed');

        try {
          if (mongoConnected) {
            const mongoose = require('mongoose');
            await mongoose.disconnect();
            logger.info('[Server] MongoDB disconnected');
          }
          if (redisClient) {
            await redisClient.quit();
            logger.info('[Server] Redis disconnected');
          }
        } catch (err) {
          logger.error('[Server] Error during shutdown:', err);
        }

        process.exit(0);
      });

      setTimeout(() => {
        logger.error('[Server] Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (err) => {
      logger.error('[Server] Unhandled Rejection:', err);
      shutdown('UNHANDLED_REJECTION');
    });
    process.on('uncaughtException', (err) => {
      logger.error('[Server] Uncaught Exception:', err);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    return server;
  } catch (error) {
    logger.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

startServer();
