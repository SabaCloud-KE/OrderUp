import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { tenantMiddleware } from './common/middlewares/tenant.middleware';
import { errorHandler } from './common/middlewares/error.middleware';

import { tenantRouter } from './modules/tenant/tenant.routes';
import { authRouter } from './modules/auth/auth.routes';
import { menuRouter } from './modules/menu/menu.routes';
import { orderRouter } from './modules/order/order.routes';
import { paymentRouter } from './modules/payment/payment.routes';
import { notificationRouter } from './modules/notification/notification.routes';
import { reportingRouter } from './modules/reporting/reporting.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { managerRouter } from './modules/manager/manager.routes';
import { waiterRouter } from './modules/waiter/waiter.routes';
import { businessRouter } from './modules/business/business.routes';

export const createApp = (): Application => {
  const app = express();

  // Trust proxy for Render/Cloud load balancers (ensures req.protocol === 'https')
  app.set('trust proxy', 1);

  // ── CORS: allow all registered frontend origins ──────────────────────────
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/+$/, ''));

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, health checks)
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        // Support wildcard '*' or exact origin match
        if (allowedOrigins.includes('*') || allowedOrigins.includes(cleanOrigin)) {
          return callback(null, true);
        }
        callback(new Error(`CORS: origin '${origin}' is not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Business-Uuid', 'X-Club-Uuid', 'X-Venue-Slug'],
    }),
  );

  // ── Helmet: security headers ──────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Serve uploads with cross-origin access from both server and workspace root directories
  const serverUploadsDir = path.resolve(__dirname, '../uploads');
  const rootUploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(serverUploadsDir)) fs.mkdirSync(serverUploadsDir, { recursive: true });
  if (!fs.existsSync(rootUploadsDir)) fs.mkdirSync(rootUploadsDir, { recursive: true });
  app.use('/uploads', express.static(serverUploadsDir));
  app.use('/uploads', express.static(rootUploadsDir));

  // ── Global rate limiter (all routes) ─────────────────────────────────────
  // Dashboards (waiter, manager, customer) poll frequently — allow 2000 req/15min
  // GET read-only polling is completely exempted to avoid false positives
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 min
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'GET', // exempt all GET polling from rate limit
    message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' } },
  });
  app.use(globalLimiter);

  // ── Strict auth rate limiter (login / password-reset) ─────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 min window
    max: 10,                     // max 10 attempts per IP
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // only count failures
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many login attempts. Please wait 15 minutes before trying again.',
      },
    },
  });

  // ── Multi-Tenant Context Resolver ─────────────────────────────────────────
  app.use(tenantMiddleware);

  // ── Swagger (dev only) ────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'production') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: env.NODE_ENV });
  });

  // ── API v1 Router ─────────────────────────────────────────────────────────
  const v1Router = express.Router();

  // Auth routes get their own strict rate limiter on sensitive endpoints
  v1Router.use('/auth/login', authLimiter);
  v1Router.use('/auth/request-password-reset', authLimiter);
  v1Router.use('/auth/reset-password', authLimiter);

  v1Router.use('/tenants', tenantRouter);
  v1Router.use('/auth', authRouter);
  v1Router.use('/menu', menuRouter);
  v1Router.use('/orders', orderRouter);
  v1Router.use('/payments', paymentRouter);
  v1Router.use('/notifications', notificationRouter);
  v1Router.use('/reports', reportingRouter);
  v1Router.use('/dashboard', dashboardRouter);
  v1Router.use('/managers', managerRouter);
  v1Router.use('/waiters', waiterRouter);
  v1Router.use('/business', businessRouter);

  app.use('/api/v1', v1Router);

  // ── Global Error Handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
};
