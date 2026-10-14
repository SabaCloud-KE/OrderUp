/**
 * Waiter Repository
 *
 * All database operations are strictly scoped by:
 *   - businessUuid (tenant boundary — from live ADMIN record, never from client)
 *   - role = 'WAITER'
 *   - deletedAt IS NULL
 *
 * Order metrics use the waiterUuid FK that exists on the Order model.
 * No in-memory filtering: all search, status, sort, and pagination occur at the DB level.
 */

import { User, UserRole, OrderStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  WaiterListItem,
  WaiterDetail,
  WaiterQueryFilters,
  PaginatedWaiters,
  WaiterActivitySummary,
} from './waiter.interface';

// Active order statuses — orders a waiter currently owns
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CLAIMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

// Completed order statuses
const COMPLETED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.DELIVERED,
];

export class WaiterRepository {
  /**
   * Compute activity metrics for a given waiter using the waiterUuid FK on orders.
   */
  private async getOrderMetrics(waiterUuid: string): Promise<{
    ordersClaimed: number;
    ordersCompleted: number;
    activeOrders: number;
  }> {
    const [ordersClaimed, ordersCompleted, activeOrders] = await Promise.all([
      prisma.order.count({ where: { waiterUuid } }),
      prisma.order.count({
        where: { waiterUuid, status: { in: COMPLETED_ORDER_STATUSES } },
      }),
      prisma.order.count({
        where: { waiterUuid, status: { in: ACTIVE_ORDER_STATUSES } },
      }),
    ]);
    return { ordersClaimed, ordersCompleted, activeOrders };
  }

  /**
   * List Waiters for a business with DB-level search, status filter, sort, and pagination.
   * Includes activity metrics (last login, account age, order counts).
   */
  async findWaiters(
    businessUuid: string,
    filters: WaiterQueryFilters,
  ): Promise<PaginatedWaiters> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 10));
    const offset = (page - 1) * limit;

    const baseScope = {
      businessUuid,
      role: UserRole.WAITER,
      deletedAt: null,
    };

    const where: any = { ...baseScope };

    if (filters.status === 'ACTIVE') {
      where.isActive = true;
    } else if (filters.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (filters.search && filters.search.trim()) {
      const query = filters.search.trim();
      where.OR = [
        { fullName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Explicit whitelist for sort fields
    const allowedSortFields: Record<string, string> = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      fullName: 'fullName',
      email: 'email',
    };
    const sortField = (filters.sortBy && allowedSortFields[filters.sortBy]) || 'createdAt';
    const sortOrder =
      filters.sortOrder && filters.sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [users, total, totalActive, totalInactive, totalOrdersHandled] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: offset,
        take: limit,
        select: {
          userUuid: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          emailVerified: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
          sessions: {
            where: { isValid: true },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { updatedAt: true },
          },
          // Count orders claimed by this waiter (via _count)
          _count: {
            select: {
              orders: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { ...baseScope, isActive: true } }),
      prisma.user.count({ where: { ...baseScope, isActive: false } }),
      // Total orders ever handled by any waiter in this business
      prisma.order.count({
        where: { businessUuid, waiterUuid: { not: null } },
      }),
    ]);

    const waiters: WaiterListItem[] = await Promise.all(
      users.map(async (u) => {
        const lastLoginAt = u.sessions[0]?.updatedAt
          ? u.sessions[0].updatedAt.toISOString()
          : null;
        const accountAgeDays = Math.floor(
          (Date.now() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        const { ordersCompleted, activeOrders } = await this.getOrderMetrics(u.userUuid);

        const activitySummary: WaiterActivitySummary = {
          lastLoginAt,
          mustChangePassword: u.mustChangePassword,
          accountAgeDays,
          ordersClaimed: u._count.orders,
          ordersCompleted,
          activeOrders,
        };

        return {
          waiterUuid: u.userUuid,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          role: u.role as UserRole,
          isActive: u.isActive,
          emailVerified: u.emailVerified,
          mustChangePassword: u.mustChangePassword,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          lastLoginAt,
          activitySummary,
        };
      }),
    );

    return {
      waiters,
      summary: {
        totalWaiters: totalActive + totalInactive,
        activeWaiters: totalActive,
        inactiveWaiters: totalInactive,
        totalOrdersHandled,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Find a single Waiter by UUID strictly scoped to the authenticated business.
   */
  async findWaiterById(
    waiterUuid: string,
    businessUuid: string,
  ): Promise<WaiterDetail | null> {
    const user = await prisma.user.findFirst({
      where: {
        userUuid: waiterUuid,
        businessUuid,
        role: UserRole.WAITER,
        deletedAt: null,
      },
      select: {
        userUuid: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        emailVerified: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        business: {
          select: {
            businessUuid: true,
            name: true,
            slug: true,
          },
        },
        sessions: {
          where: { isValid: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { updatedAt: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!user) return null;

    const lastLoginAt = user.sessions[0]?.updatedAt
      ? user.sessions[0].updatedAt.toISOString()
      : null;
    const accountAgeDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const { ordersCompleted, activeOrders } = await this.getOrderMetrics(waiterUuid);

    return {
      waiterUuid: user.userUuid,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role as UserRole,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt,
      activitySummary: {
        lastLoginAt,
        mustChangePassword: user.mustChangePassword,
        accountAgeDays,
        ordersClaimed: user._count.orders,
        ordersCompleted,
        activeOrders,
      },
      business: {
        id: user.business?.businessUuid || businessUuid,
        name: user.business?.name || 'Unknown Business',
        slug: user.business?.slug || '',
      },
    };
  }

  /**
   * Check if a non-deleted user with the given email already exists globally.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  /**
   * Create a new Waiter record.
   * Role is strictly set to UserRole.WAITER server-side.
   */
  async createWaiter(data: {
    businessUuid: string;
    fullName: string;
    email: string;
    phone?: string;
    passwordHash: string;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        businessUuid: data.businessUuid,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: UserRole.WAITER,
        isActive: true,
        mustChangePassword: true,
        emailVerified: true,
      },
    });
  }

  /**
   * Update permitted fields for a Waiter scoped to the business.
   */
  async updateWaiter(
    waiterUuid: string,
    businessUuid: string,
    data: { fullName?: string; email?: string; phone?: string },
  ): Promise<User | null> {
    const existing = await prisma.user.findFirst({
      where: {
        userUuid: waiterUuid,
        businessUuid,
        role: UserRole.WAITER,
        deletedAt: null,
      },
    });

    if (!existing) return null;

    return prisma.user.update({
      where: { userUuid: waiterUuid },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Reset waiter password and revoke all active sessions and tokens.
   */
  async resetWaiterPassword(
    waiterUuid: string,
    businessUuid: string,
    passwordHash: string,
  ): Promise<User | null> {
    const existing = await prisma.user.findFirst({
      where: {
        userUuid: waiterUuid,
        businessUuid,
        role: UserRole.WAITER,
        deletedAt: null,
      },
    });

    if (!existing) return null;

    const [updated] = await Promise.all([
      prisma.user.update({
        where: { userUuid: waiterUuid },
        data: {
          passwordHash,
          mustChangePassword: true,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          updatedAt: new Date(),
        },
      }),
      prisma.userSession.updateMany({
        where: { userUuid: waiterUuid, isValid: true },
        data: { isValid: false },
      }),
      prisma.refreshToken.updateMany({
        where: { userUuid: waiterUuid, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    return updated;
  }

  /**
   * Activate or Deactivate a Waiter.
   * On deactivation, immediately revokes all active sessions and refresh tokens.
   */
  async updateWaiterStatus(
    waiterUuid: string,
    businessUuid: string,
    isActive: boolean,
  ): Promise<User | null> {
    const existing = await prisma.user.findFirst({
      where: {
        userUuid: waiterUuid,
        businessUuid,
        role: UserRole.WAITER,
        deletedAt: null,
      },
    });

    if (!existing) return null;

    const updated = await prisma.user.update({
      where: { userUuid: waiterUuid },
      data: { isActive, updatedAt: new Date() },
    });

    if (!isActive) {
      await Promise.all([
        prisma.userSession.updateMany({
          where: { userUuid: waiterUuid, isValid: true },
          data: { isValid: false },
        }),
        prisma.refreshToken.updateMany({
          where: { userUuid: waiterUuid, isRevoked: false },
          data: { isRevoked: true },
        }),
      ]);
    }

    return updated;
  }

  /**
   * Soft-delete a Waiter — sets deletedAt, deactivates, revokes sessions and tokens.
   */
  async softDeleteWaiter(
    waiterUuid: string,
    businessUuid: string,
  ): Promise<User | null> {
    const existing = await prisma.user.findFirst({
      where: {
        userUuid: waiterUuid,
        businessUuid,
        role: UserRole.WAITER,
        deletedAt: null,
      },
    });

    if (!existing) return null;

    const [deleted] = await Promise.all([
      prisma.user.update({
        where: { userUuid: waiterUuid },
        data: {
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date(),
        },
      }),
      prisma.userSession.updateMany({
        where: { userUuid: waiterUuid, isValid: true },
        data: { isValid: false },
      }),
      prisma.refreshToken.updateMany({
        where: { userUuid: waiterUuid, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    return deleted;
  }

  /**
   * Record an audit log entry for Waiter operations.
   * Failures are swallowed — audit logs must never block primary transactions.
   */
  async createAuditLog(data: {
    businessUuid: string;
    userUuid: string;
    action: string;
    entityType: string;
    entityUuid: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          businessUuid: data.businessUuid,
          userUuid: data.userUuid,
          action: data.action,
          entityType: data.entityType,
          entityUuid: data.entityUuid,
          oldValues: data.oldValues
            ? JSON.parse(JSON.stringify(data.oldValues))
            : undefined,
          newValues: data.newValues
            ? JSON.parse(JSON.stringify(data.newValues))
            : undefined,
          ipAddress: data.ipAddress,
        },
      });
    } catch {
      // Audit log failures must never interrupt primary operations
    }
  }
}
