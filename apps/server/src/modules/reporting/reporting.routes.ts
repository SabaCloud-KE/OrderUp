/**
 * Reporting Routes
 *
 * Admin report endpoints:
 *   GET /api/v1/reports/admin/overview
 *   GET /api/v1/reports/admin/revenue
 *   GET /api/v1/reports/admin/orders
 *   GET /api/v1/reports/admin/payments
 *   GET /api/v1/reports/admin/products
 *   GET /api/v1/reports/admin/categories
 *   GET /api/v1/reports/admin/waiters
 *   GET /api/v1/reports/admin/export
 *
 * Legacy:
 *   GET /api/v1/reports/analytics
 *
 * Security:
 *   - authenticate: JWT verification
 *   - authorize([UserRole.ADMIN]): ADMIN-only for /admin/* routes
 *   - requireTenantScope: tenant boundary guard from live DB record
 *   - validateRequest: Zod strict schema validation
 */

import { Router } from 'express';
import { UserRole } from '@orderup/shared';
import {
  authenticate,
  authorize,
  requireTenantScope,
} from '../../common/middlewares/auth.middleware';
import { validateRequest } from '../../common/middlewares/validate.middleware';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';
import {
  adminReportQuerySchema,
  adminExportQuerySchema,
  getReportSchema,
} from './reporting.schema';

const reportingService = new ReportingService();
const reportingController = new ReportingController(reportingService);

export const reportingRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only reporting endpoints (ADMIN role, live tenant scope)
// ─────────────────────────────────────────────────────────────────────────────

reportingRouter.get(
  '/admin/overview',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  validateRequest(adminReportQuerySchema),
  reportingController.getAdminOverview,
);

reportingRouter.get(
  '/admin/revenue',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  validateRequest(adminReportQuerySchema),
  reportingController.getAdminRevenue,
);

reportingRouter.get(
  '/admin/orders',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  validateRequest(adminReportQuerySchema),
  reportingController.getAdminOrders,
);

reportingRouter.get(
  '/admin/payments',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  validateRequest(adminReportQuerySchema),
  reportingController.getAdminPayments,
);

reportingRouter.get(
  '/admin/products',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  validateRequest(adminReportQuerySchema),
  reportingController.getAdminProducts,
);

reportingRouter.get(
  '/admin/categories',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  validateRequest(adminReportQuerySchema),
  reportingController.getAdminCategories,
);

reportingRouter.get(
  '/admin/waiters',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  validateRequest(adminReportQuerySchema),
  reportingController.getAdminWaiters,
);

reportingRouter.get(
  '/admin/export',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  validateRequest(adminExportQuerySchema),
  reportingController.exportAdminReport,
);

// ─────────────────────────────────────────────────────────────────────────────
// Legacy analytics endpoint (preserved for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

reportingRouter.get(
  '/analytics',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(getReportSchema),
  reportingController.getAnalytics,
);
