import { Router } from 'express';
import { TenantRepository } from './tenant.repository';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { validateRequest } from '../../common/middlewares/validate.middleware';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { uploadImage } from '../../common/middlewares/upload.middleware';
import { UserRole } from '@orderup/shared';
import {
  createBusinessSchema,
  createBusinessWithAdminSchema,
  updateBusinessSchema,
  assignManagerSchema,
  generateQrCodesSchema,
} from './tenant.schema';

const tenantRepository = new TenantRepository();
const tenantService = new TenantService(tenantRepository);
const tenantController = new TenantController(tenantService);

export const tenantRouter = Router();

tenantRouter.get(
  '/platform/stats',
  authenticate,
  authorize([UserRole.SUPER_ADMIN]),
  tenantController.getPlatformStats,
);

tenantRouter.get(
  '/current',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER]),
  tenantController.getCurrentBusiness,
);

tenantRouter.get('/', tenantController.getAll);
tenantRouter.get('/:slug', tenantController.getBySlug);

tenantRouter.post(
  '/upload',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  uploadImage.single('file'),
  tenantController.uploadImage,
);

tenantRouter.post(
  '/provision',
  authenticate,
  authorize([UserRole.SUPER_ADMIN]),
  validateRequest(createBusinessWithAdminSchema),
  tenantController.provision,
);

tenantRouter.post(
  '/',
  authenticate,
  authorize([UserRole.SUPER_ADMIN]),
  validateRequest(createBusinessSchema),
  tenantController.create,
);

tenantRouter.put(
  '/:clubUuid',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  validateRequest(updateBusinessSchema),
  tenantController.update,
);
tenantRouter.patch(
  '/:clubUuid',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  validateRequest(updateBusinessSchema),
  tenantController.update,
);

tenantRouter.patch(
  '/:clubUuid/suspend',
  authenticate,
  authorize([UserRole.SUPER_ADMIN]),
  tenantController.suspend,
);

tenantRouter.patch(
  '/:clubUuid/activate',
  authenticate,
  authorize([UserRole.SUPER_ADMIN]),
  tenantController.activate,
);

tenantRouter.delete(
  '/:clubUuid',
  authenticate,
  authorize([UserRole.SUPER_ADMIN]),
  tenantController.delete,
);

tenantRouter.post(
  '/:clubUuid/assign-manager',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  validateRequest(assignManagerSchema),
  tenantController.assignManager,
);

tenantRouter.get(
  '/:clubUuid/tables',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER]),
  tenantController.getTables,
);

tenantRouter.post(
  '/:clubUuid/generate-qr',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(generateQrCodesSchema),
  tenantController.generateQrCodes,
);

tenantRouter.delete(
  '/:clubUuid/tables/:tableNumber',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  tenantController.deleteTable,
);



