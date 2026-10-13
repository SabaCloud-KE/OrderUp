import { Router } from 'express';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { validateRequest } from '../../common/middlewares/validate.middleware';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { UserRole } from '@orderup/shared';
import {
  createOrderSchema,
  claimOrderSchema,
  updateOrderStatusSchema,
} from './order.schema';

const orderRepository = new OrderRepository();
const orderService = new OrderService(orderRepository);
const orderController = new OrderController(orderService);

export const orderRouter = Router();

orderRouter.get(
  '/',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER]),
  orderController.getOrders,
);
orderRouter.get('/my-active', authenticate, orderController.getMyActiveOrder);
orderRouter.get('/:orderUuid', orderController.getById);
orderRouter.post('/', validateRequest(createOrderSchema), orderController.create);

orderRouter.post(
  '/:orderUuid/claim',
  authenticate,
  authorize([UserRole.WAITER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(claimOrderSchema),
  orderController.claim,
);

orderRouter.patch(
  '/:orderUuid/status',
  authenticate,
  authorize([UserRole.WAITER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  validateRequest(updateOrderStatusSchema),
  orderController.updateStatus,
);

