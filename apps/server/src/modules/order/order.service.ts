import { Order, OrderStatus } from '@prisma/client';
import { IOrderRepository } from './order.interface';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error';
import { getIO } from '../../config/socket';
import { logger } from '../../config/logger';
import { prisma } from '../../config/prisma';

export class OrderService {
  constructor(private orderRepository: IOrderRepository) {}

  async getOrderById(orderUuid: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderUuid);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return order;
  }

  async getOrdersForBusiness(businessUuid?: string, status?: OrderStatus, waiterUuid?: string, limit?: number): Promise<Order[]> {
    let targetUuid = businessUuid;
    if (targetUuid === 'default-club' || targetUuid === 'default-business') {
      const firstBiz = await prisma.business.findFirst({ where: { deletedAt: null } });
      if (firstBiz) targetUuid = firstBiz.businessUuid;
    }
    return this.orderRepository.findOrdersByBusiness(targetUuid, status, waiterUuid, limit);
  }

  // Backward compatibility alias
  async getOrdersForClub(clubUuid?: string, status?: OrderStatus, waiterUuid?: string, limit?: number): Promise<Order[]> {
    return this.getOrdersForBusiness(clubUuid, status, waiterUuid, limit);
  }

  async getActiveClaimedOrderByWaiter(waiterUuid: string): Promise<Order | null> {
    return this.orderRepository.findActiveClaimedOrderByWaiter(waiterUuid);
  }

  async getActiveClaimedOrdersByWaiter(waiterUuid: string): Promise<Order[]> {
    return this.orderRepository.findAllActiveOrdersByWaiter(waiterUuid);
  }

  async createOrder(businessUuid: string, data: any, actorUserUuid?: string): Promise<Order> {
    const order = await this.orderRepository.createOrder(businessUuid, data);

    // Emit Realtime Socket.IO Event for Kitchen & Waiters
    try {
      const io = getIO();
      io.to(`tenant:${businessUuid}`).emit('new_order', order);
      io.to(`tenant:${businessUuid}:kitchen`).emit('new_order_kitchen', order);
    } catch (_e) {
      logger.warn('Socket.IO not ready for new_order broadcast.');
    }

    // Audit: fire-and-forget
    prisma?.auditLog?.create?.({
      data: {
        businessUuid: businessUuid || null,
        userUuid: actorUserUuid || data?.waiterUuid || null,
        action: 'ORDER_CREATED',
        entityType: 'ORDER',
        entityUuid: (order as any).orderUuid,
        newValues: {
          orderNumber: (order as any).orderNumber,
          totalAmount: (order as any).totalAmount,
          status: (order as any).status,
        },
      },
    })?.catch?.(() => {/* non-fatal */});

    return order;
  }

  async claimOrder(orderUuid: string, waiterUuid: string): Promise<Order> {
    const order = await this.getOrderById(orderUuid);

    if (order.status !== 'PENDING') {
      throw new BadRequestError(`Order cannot be claimed because its status is '${order.status}'`);
    }

    // ENFORCE OPTION B: Waiter can claim up to 2 concurrent orders,
    // but the second order is only unlocked once the first is in PREPARING status.
    const activeOrders = await this.orderRepository.findAllActiveOrdersByWaiter(waiterUuid);
    if (activeOrders.length >= 2) {
      throw new BadRequestError(
        'You already have 2 active orders in progress. Please complete and deliver them before claiming another!',
      );
    }

    if (activeOrders.length === 1) {
      const current = activeOrders[0];
      if (current.status === 'CLAIMED') {
        const tableStr = (current as any).table?.tableNumber ? `at Table #${(current as any).table.tableNumber}` : '';
        throw new BadRequestError(
          `Please mark your current order ${tableStr} as Preparing Order before claiming a second order!`,
        );
      }
      if (current.status === 'READY') {
        const tableStr = (current as any).table?.tableNumber ? `at Table #${(current as any).table.tableNumber}` : '';
        throw new BadRequestError(
          `Your order ${tableStr} is ready for delivery! Please deliver it before claiming a new order.`,
        );
      }
    }

    let claimedOrder: Order;
    try {
      claimedOrder = await this.orderRepository.claimOrder(orderUuid, waiterUuid);
    } catch (err: any) {
      if (err?.message === 'ORDER_ALREADY_CLAIMED') {
        // Race condition: another waiter claimed it between our check and the update
        throw new BadRequestError('This order was just claimed by another waiter. Please refresh and try again.');
      }
      throw err;
    }

    // Emit Realtime Socket.IO Event - Disappears for all other waiters in real time!
    try {
      const io = getIO();
      const businessUuid = (order as any).businessUuid || (order as any).clubUuid;
      io.to(`tenant:${businessUuid}`).emit('order_claimed', {
        orderUuid,
        waiterUuid,
        waiterName: (claimedOrder as any).waiter?.fullName || 'Waiter',
        claimedOrder,
      });
    } catch (_e) {
      logger.warn('Socket.IO not ready for order_claimed broadcast.');
    }

    // Audit: fire-and-forget
    prisma?.auditLog?.create?.({
      data: {
        businessUuid: ((order as any).businessUuid || (order as any).clubUuid) || null,
        userUuid: waiterUuid,
        action: 'ORDER_CLAIMED',
        entityType: 'ORDER',
        entityUuid: orderUuid,
        newValues: { waiterUuid, orderNumber: (claimedOrder as any).orderNumber },
      },
    })?.catch?.(() => {/* non-fatal */});

    return claimedOrder;
  }

  async updateOrderStatus(orderUuid: string, status: OrderStatus, actorUserUuid?: string): Promise<Order> {
    const order = await this.getOrderById(orderUuid);
    const updatedOrder = await this.orderRepository.updateStatus(orderUuid, status);

    // Broadcast Realtime Update
    try {
      const io = getIO();
      const businessUuid = (order as any).businessUuid || (order as any).clubUuid;
      io.to(`tenant:${businessUuid}`).emit('order_status_updated', {
        orderUuid,
        status,
        updatedOrder,
      });
    } catch (_e) {
      logger.warn('Socket.IO not ready for order_status_updated broadcast.');
    }

    // Audit: fire-and-forget
    prisma?.auditLog?.create?.({
      data: {
        businessUuid: ((order as any).businessUuid || (order as any).clubUuid) || null,
        userUuid: actorUserUuid || null,
        action: 'ORDER_STATUS_UPDATED',
        entityType: 'ORDER',
        entityUuid: orderUuid,
        oldValues: { status: order.status },
        newValues: { status },
      },
    })?.catch?.(() => {/* non-fatal */});

    return updatedOrder;
  }
}
