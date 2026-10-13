/**
 * Business Routes
 *
 * Dedicated ADMIN-only endpoints for managing Business Profile and Settings.
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
import { uploadImage } from '../../common/middlewares/upload.middleware';
import { BusinessRepository } from './business.repository';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import {
  updateBusinessProfileSchema,
  updateBusinessSettingsSchema,
} from './business.schema';

const businessRepository = new BusinessRepository();
const businessService = new BusinessService(businessRepository);
const businessController = new BusinessController(businessService);

export const businessRouter = Router();

// Apply authentication and ADMIN authorization to all business profile & settings routes
businessRouter.use(authenticate, authorize([UserRole.ADMIN]), requireTenantScope);

/**
 * @openapi
 * /business/profile:
 *   get:
 *     summary: Retrieve business profile and operating settings
 *     tags: [Business]
 *   patch:
 *     summary: Update allowed business profile fields
 *     tags: [Business]
 */
businessRouter.get('/profile', businessController.getProfile);
businessRouter.patch(
  '/profile',
  validateRequest(updateBusinessProfileSchema),
  businessController.updateProfile,
);

/**
 * @openapi
 * /business/settings:
 *   patch:
 *     summary: Update operational and branding settings
 *     tags: [Business]
 */
businessRouter.patch(
  '/settings',
  validateRequest(updateBusinessSettingsSchema),
  businessController.updateSettings,
);

/**
 * @openapi
 * /business/logo:
 *   post:
 *     summary: Upload and update business logo
 *     tags: [Business]
 */
businessRouter.post(
  '/logo',
  uploadImage.single('logo'),
  businessController.uploadLogo,
);
