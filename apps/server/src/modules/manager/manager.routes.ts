/**
 * Manager Routes
 *
 * Dedicated ADMIN-only endpoints for managing Managers.
 * Protected by:
 *   - authenticate (JWT verification)
 *   - authorize([UserRole.ADMIN]) (ADMIN role only)
 *   - requireTenantScope
 *   - validateRequest (strict Zod schema validation)
 */

import { Router } from 'express';
import { UserRole } from '@orderup/shared';
import {
  authenticate,
  authorize,
  requireTenantScope,
} from '../../common/middlewares/auth.middleware';
import { validateRequest } from '../../common/middlewares/validate.middleware';
import { ManagerRepository } from './manager.repository';
import { ManagerService } from './manager.service';
import { ManagerController } from './manager.controller';
import {
  createManagerSchema,
  updateManagerSchema,
  updateManagerStatusSchema,
  resetPasswordManagerSchema,
  getManagerParamsSchema,
  listManagersQuerySchema,
} from './manager.schema';

const managerRepository = new ManagerRepository();
const managerService = new ManagerService(managerRepository);
const managerController = new ManagerController(managerService);

export const managerRouter = Router();

// Apply authentication and ADMIN authorization to all Manager endpoints
managerRouter.use(authenticate, authorize([UserRole.ADMIN]), requireTenantScope);

/**
 * @openapi
 * /managers:
 *   get:
 *     summary: List managers for the authenticated Admin business
 *     tags: [Managers]
 *   post:
 *     summary: Create a new Manager account
 *     tags: [Managers]
 */
managerRouter.get('/', validateRequest(listManagersQuerySchema), managerController.getManagers);
managerRouter.post('/', validateRequest(createManagerSchema), managerController.createManager);

/**
 * @openapi
 * /managers/{managerUuid}:
 *   get:
 *     summary: Get details of a single Manager
 *     tags: [Managers]
 *   patch:
 *     summary: Update permitted Manager information
 *     tags: [Managers]
 *   delete:
 *     summary: Soft-delete a Manager
 *     tags: [Managers]
 */
managerRouter.get(
  '/:managerUuid',
  validateRequest(getManagerParamsSchema),
  managerController.getManagerById,
);
managerRouter.patch(
  '/:managerUuid',
  validateRequest(updateManagerSchema),
  managerController.updateManager,
);
managerRouter.delete(
  '/:managerUuid',
  validateRequest(getManagerParamsSchema),
  managerController.deleteManager,
);

/**
 * @openapi
 * /managers/{managerUuid}/status:
 *   patch:
 *     summary: Activate or deactivate a Manager
 *     tags: [Managers]
 */
managerRouter.patch(
  '/:managerUuid/status',
  validateRequest(updateManagerStatusSchema),
  managerController.setManagerStatus,
);

/**
 * @openapi
 * /managers/{managerUuid}/reset-password:
 *   post:
 *     summary: Initiate password reset for a Manager
 *     tags: [Managers]
 */
managerRouter.post(
  '/:managerUuid/reset-password',
  validateRequest(resetPasswordManagerSchema),
  managerController.resetPassword,
);
