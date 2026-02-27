require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { initDB, closeDB } = require('./config/database');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await initDB();
    const server = app.listen(PORT, () => {
      logger.info(`AIIA Backbone running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    let isShuttingDown = false;

    const gracefulShutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(async (closeErr) => {
        if (closeErr) {
          logger.error(`HTTP server close error: ${closeErr.message}`);
        }

        try {
          await closeDB();
          process.exit(closeErr ? 1 : 0);
        } catch (dbErr) {
          logger.error(`Database close error: ${dbErr.message}`);
          process.exit(1);
        }
      });

      // Safety timeout so process doesn't hang forever.
      setTimeout(() => {
        logger.error('Forced shutdown after graceful timeout.');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    process.on('unhandledRejection', async (err) => {
      logger.error(`Unhandled Rejection: ${err?.stack || err?.message || err}`);
      await gracefulShutdown('unhandledRejection');
    });

    process.on('uncaughtException', async (err) => {
      logger.error(`Uncaught Exception: ${err?.stack || err?.message || err}`);
      await gracefulShutdown('uncaughtException');
    });
  } catch (err) {
    logger.error(`Failed to initialize database: ${err.message}`);
    process.exit(1);
  }
})();
