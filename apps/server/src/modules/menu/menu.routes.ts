import { Router } from 'express';
import { MenuRepository } from './menu.repository';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { validateRequest } from '../../common/middlewares/validate.middleware';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { uploadImage } from '../../common/middlewares/upload.middleware';
import { UserRole } from '@orderup/shared';
import {
  createCategorySchema,
  updateCategorySchema,
  updateCategoryOrderSchema,
  createProductSchema,
  updateProductSchema,
  createOfferSchema,
} from './menu.schema';

const menuRepository = new MenuRepository();
const menuService = new MenuService(menuRepository);
const menuController = new MenuController(menuService);

export const menuRouter = Router();

menuRouter.get('/', menuController.getMenu);
menuRouter.get('/slug/:slug', menuController.getMenu);

menuRouter.post(
  '/categories',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(createCategorySchema),
  menuController.createCategory,
);

menuRouter.put(
  '/categories/:categoryUuid',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(updateCategorySchema),
  menuController.updateCategory,
);

menuRouter.delete(
  '/categories/:categoryUuid',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  menuController.archiveCategory,
);

menuRouter.post(
  '/categories/reorder',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(updateCategoryOrderSchema),
  menuController.updateCategoryOrders,
);

menuRouter.post(
  '/products',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(createProductSchema),
  menuController.createProduct,
);

menuRouter.put(
  '/products/:productUuid',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(updateProductSchema),
  menuController.updateProduct,
);

menuRouter.patch(
  '/products/:productUuid/availability',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER]),
  menuController.toggleAvailability,
);

menuRouter.delete(
  '/products/:productUuid',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  menuController.archiveProduct,
);

menuRouter.post(
  '/upload',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  uploadImage.single('image'),
  menuController.uploadImage,
);

menuRouter.post(
  '/offers',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  validateRequest(createOfferSchema),
  menuController.createOffer,
);

menuRouter.delete(
  '/offers/:offerUuid',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  menuController.deleteOffer,
);

menuRouter.patch(
  '/offers/:offerUuid/toggle',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  menuController.toggleOffer,
);

