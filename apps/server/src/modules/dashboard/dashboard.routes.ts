/**
 * Dashboard Routes
 *
 * Registers the Admin Dashboard Overview endpoint.
 *
 * Authorization chain:
 *   1. authenticate       — Validates JWT, rejects invalid/expired/deprecated tokens
 *   2. authorize([ADMIN]) — Only ADMIN role is permitted (403 for all other roles)
 *   3. requireTenantScope — Resolves businessUuid from JWT into req.businessUuid
 *   4. controller         — Reads req.businessUuid, calls service, returns data
 *
 * Roles blocked:
 *   MANAGER     → 403 Insufficient permissions
 *   WAITER      → 403 Insufficient permissions
 *   CUSTOMER    → 403 Insufficient permissions
 *   SUPER_ADMIN → 403 Insufficient permissions (has own separate dashboard)
 *   Unauthenticated → 401 Unauthorized
 */

import { Router } from 'express';
import { UserRole } from '@orderup/shared';
import { authenticate, authorize, requireTenantScope } from '../../common/middlewares/auth.middleware';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

const dashboardService = new DashboardService();
const dashboardController = new DashboardController(dashboardService);

export const dashboardRouter = Router();

/**
 * @openapi
 * /dashboard/admin/overview:
 *   get:
 *     summary: Admin Business Dashboard Overview
 *     description: >
 *       Returns today's revenue, order counts by status, staff counts, recent orders,
 *       top-selling menu items, and a 7-day sales trend — all scoped exclusively
 *       to the authenticated ADMIN's business.
 *       Business scope is resolved server-side from the JWT. No businessId is accepted
 *       from the client.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview data for the authenticated ADMIN's business
 *       401:
 *         description: Authentication required or token invalid/expired
 *       403:
 *         description: Insufficient permissions (role is not ADMIN) or no business association
 */
dashboardRouter.get(
  '/admin/overview',
  authenticate,
  authorize([UserRole.ADMIN]),
  requireTenantScope,
  dashboardController.getAdminOverview,
);
