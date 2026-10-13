/**
 * Waiter Routes
 *
 * All endpoints require:
 *   - authenticate (JWT verification)
 *   - authorize([UserRole.ADMIN]) (ADMIN-only access)
 *   - requireTenantScope (tenant context guard)
 *   - validateRequest (Zod strict schema validation)
 *
 * Mounted at /api/v1/waiters in app.ts
 */

import { Router } from 'express';
import { UserRole } from '@orderup/shared';
import {
  authenticate,
  authorize,
  requireTenantScope,
} from '../../common/middlewares/auth.middleware';
import { validateRequest } from '../../common/middlewares/validate.middleware';
import { WaiterRepository } from './waiter.repository';
import { WaiterService } from './waiter.service';
import { WaiterController } from './waiter.controller';
import {
  createWaiterSchema,
  updateWaiterSchema,
  updateWaiterStatusSchema,
  resetPasswordWaiterSchema,
  getWaiterParamsSchema,
  listWaitersQuerySchema,
} from './waiter.schema';

const waiterRepository = new WaiterRepository();
const waiterService = new WaiterService(waiterRepository);
const waiterController = new WaiterController(waiterService);

export const waiterRouter = Router();

// Apply authentication and ADMIN authorization to all Waiter endpoints
waiterRouter.use(authenticate, authorize([UserRole.ADMIN]), requireTenantScope);

/**
 * GET /api/v1/waiters
 * POST /api/v1/waiters
 */
waiterRouter.get('/', validateRequest(listWaitersQuerySchema), waiterController.getWaiters);
waiterRouter.post('/', validateRequest(createWaiterSchema), waiterController.createWaiter);

/**
 * GET /api/v1/waiters/:waiterUuid
 * PATCH /api/v1/waiters/:waiterUuid
 * DELETE /api/v1/waiters/:waiterUuid
 */
waiterRouter.get(
  '/:waiterUuid',
  validateRequest(getWaiterParamsSchema),
  waiterController.getWaiterById,
);
waiterRouter.patch(
  '/:waiterUuid',
  validateRequest(updateWaiterSchema),
  waiterController.updateWaiter,
);
waiterRouter.delete(
  '/:waiterUuid',
  validateRequest(getWaiterParamsSchema),
  waiterController.deleteWaiter,
);

/**
 * PATCH /api/v1/waiters/:waiterUuid/status
 */
waiterRouter.patch(
  '/:waiterUuid/status',
  validateRequest(updateWaiterStatusSchema),
  waiterController.setWaiterStatus,
);

/**
 * POST /api/v1/waiters/:waiterUuid/reset-password
 */
waiterRouter.post(
  '/:waiterUuid/reset-password',
  validateRequest(resetPasswordWaiterSchema),
  waiterController.resetPassword,
);
