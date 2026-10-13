import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './env';
import { logger } from './logger';

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/+$/, ''));
  const clientOrigin = env.CLIENT_URL ? env.CLIENT_URL.trim().replace(/\/+$/, '') : '';

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (allowedOrigins.includes('*') || allowedOrigins.includes(cleanOrigin) || cleanOrigin === clientOrigin) {
          return callback(null, true);
        }
        return callback(new Error(`CORS: origin '${origin}' is not allowed`), false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Realtime client connected: ${socket.id}`);

    socket.on('join_tenant', (tenantId: string) => {
      socket.join(`tenant:${tenantId}`);
      logger.info(`Socket ${socket.id} joined tenant room: tenant:${tenantId}`);
    });

    socket.on('join_kitchen', (tenantId: string) => {
      socket.join(`tenant:${tenantId}:kitchen`);
      logger.info(`Socket ${socket.id} joined kitchen room: tenant:${tenantId}:kitchen`);
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Realtime client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized!');
  }
  return io;
};
