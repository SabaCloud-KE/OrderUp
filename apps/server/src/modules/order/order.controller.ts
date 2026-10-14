import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service';

export class OrderController {
  constructor(private orderService: OrderService) {}

  getOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = (req.user?.role || '').toUpperCase();
      let businessUuid: string;

      if (userRole === 'SUPER_ADMIN') {
        businessUuid =
          (req.query.businessUuid as string) ||
          (req.query.clubUuid as string) ||
          req.businessUuid ||
          req.user?.businessUuid ||
          '';
      } else if (req.user) {
        businessUuid =
          req.user.businessUuid ||
          req.user.tenantId ||
          (req.user as any).clubUuid ||
          req.businessUuid ||
          '';
      } else {
        businessUuid =
          (req.headers['x-business-uuid'] as string) ||
          (req.headers['x-tenant-id'] as string) ||
          (req.query.businessUuid as string) ||
          (req.query.clubUuid as string) ||
          req.businessUuid ||
          '';
      }

      const status = req.query.status as any;
      const waiterUuid = req.query.waiterUuid as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const orders = await this.orderService.getOrdersForBusiness(businessUuid, status, waiterUuid, limit);
      res.json({
        success: true,
        data: orders,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  getMyActiveOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const waiterUuid = req.user?.userId;
      if (!waiterUuid) {
        res.json({
          success: true,
          data: [],
          meta: { timestamp: new Date().toISOString(), version: 'v1' },
        });
        return;
      }
      const orders = await this.orderService.getActiveClaimedOrdersByWaiter(waiterUuid);
      res.json({
        success: true,
        data: orders,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderUuid } = req.params;
      const order = await this.orderService.getOrderById(orderUuid);
      res.json({
        success: true,
        data: order,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessUuid =
        req.businessUuid ||
        req.user?.businessUuid ||
        req.user?.tenantId ||
        (req.headers['x-business-uuid'] as string) ||
        (req.headers['x-tenant-id'] as string) ||
        req.body.businessUuid ||
        req.body.clubUuid;

      const order = await this.orderService.createOrder(businessUuid, req.body, req.user?.userId);
      res.status(201).json({
        success: true,
        data: order,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  claim = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderUuid } = req.params;
      const waiterUuid = req.user?.userId || req.body.waiterUuid;
      const order = await this.orderService.claimOrder(orderUuid, waiterUuid);
      res.json({
        success: true,
        data: order,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderUuid } = req.params;
      const { status } = req.body;
      const order = await this.orderService.updateOrderStatus(orderUuid, status, req.user?.userId);
      res.json({
        success: true,
        data: order,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };
}
