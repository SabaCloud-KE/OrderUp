import { Order, OrderStatus } from '@prisma/client';

export interface IOrderRepository {
  findById(orderUuid: string): Promise<Order | null>;
  findOrdersByBusiness(businessUuid?: string, status?: OrderStatus, waiterUuid?: string, limit?: number): Promise<Order[]>;
  findActiveClaimedOrderByWaiter(waiterUuid: string): Promise<Order | null>;
  findAllActiveOrdersByWaiter(waiterUuid: string): Promise<Order[]>;
  createOrder(businessUuid: string, data: any): Promise<Order>;
  claimOrder(orderUuid: string, waiterUuid: string): Promise<Order>;
  updateStatus(orderUuid: string, status: OrderStatus): Promise<Order>;

  // Backward compatibility
  findOrdersByClub?(clubUuid?: string, status?: OrderStatus, waiterUuid?: string, limit?: number): Promise<Order[]>;
}
