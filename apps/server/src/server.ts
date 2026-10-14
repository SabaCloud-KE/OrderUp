import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initSocket } from './config/socket';
import { prisma } from './config/prisma';
import { autoMigrateDatabase } from './config/migrate';

const app = createApp();
const server = http.createServer(app);

// Initialize Socket.IO Realtime Engine
initSocket(server);

const PORT = parseInt(env.PORT, 10) || 5000;

async function bootstrap() {
  server.listen(PORT, () => {
    logger.info(`🚀 OrderUp Backend Server running on port ${PORT} [${env.NODE_ENV}]`);
    logger.info(`📄 Swagger API Docs available at http://localhost:${PORT}/api-docs`);
  });

  // Run auto-migration asynchronously in background to ensure zero cold-start delay
  autoMigrateDatabase().catch((err) => {
    logger.warn(`Non-blocking database auto-migration note: ${err.message}`);
  });
}

bootstrap().catch((err) => {
  logger.error(`Fatal server bootstrap failure: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP Server closed.');
    await prisma.$disconnect();
    logger.info('Database connection closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
