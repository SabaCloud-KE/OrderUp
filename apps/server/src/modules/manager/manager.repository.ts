/**
 * Manager Repository
 *
 * All database operations are strictly scoped by:
 *   - businessUuid (tenant boundary)
 *   - role = 'MANAGER'
 *   - deletedAt IS NULL
 *
 * No in-memory filtering: all search, status filters, sort order, and pagination occur at the DB level.
 */

import { User, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  ManagerListItem,
  ManagerDetail,
  ManagerQueryFilters,
  PaginatedManagers,
} from './manager.interface';

export class ManagerRepository {
  /**
   * List Managers for a given business with database-level search, status filter, sort, and pagination.
   */
  async findManagers(
    businessUuid: string,
    filters: ManagerQueryFilters,
  ): Promise<PaginatedManagers> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 10));
    const offset = (page - 1) * limit;

    const baseScope = {
      businessUuid,
      role: UserRole.MANAGER,
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

    // Explicit whitelist for sorting
    const allowedSortFields: Record<string, string> = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      fullName: 'fullName',
      email: 'email',
    };
    const sortField = (filters.sortBy && allowedSortFields[filters.sortBy]) || 'createdAt';
    const sortOrder = (filters.sortOrder && filters.sortOrder.toLowerCase() === 'asc') ? 'asc' : 'desc';

    const [users, total, totalActive, totalInactive] = await Promise.all([
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
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { ...baseScope, isActive: true } }),
      prisma.user.count({ where: { ...baseScope, isActive: false } }),
    ]);

    const managers: ManagerListItem[] = users.map((u) => {
      const lastLoginAt = u.sessions[0]?.updatedAt ? u.sessions[0].updatedAt.toISOString() : null;
      const accountAgeDays = Math.floor((Date.now() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        managerUuid: u.userUuid,
        userUuid: u.userUuid,
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
        activitySummary: {
          lastLoginAt,
          mustChangePassword: u.mustChangePassword,
          accountAgeDays,
        },
      };
    });

    return {
      managers,
      summary: {
        totalManagers: totalActive + totalInactive,
        activeManagers: totalActive,
        inactiveManagers: totalInactive,
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
   * Find a single Manager by UUID strictly scoped to the authenticated business.
   */
  async findManagerById(managerUuid: string, businessUuid: string): Promise<ManagerDetail | null> {
    const user = await prisma.user.findFirst({
      where: {
        userUuid: managerUuid,
        businessUuid,
        role: UserRole.MANAGER,
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
      },
    });

    if (!user) return null;

    const lastLoginAt = user.sessions[0]?.updatedAt ? user.sessions[0].updatedAt.toISOString() : null;
    const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    return {
      managerUuid: user.userUuid,
      userUuid: user.userUuid,
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
   * Create a new Manager record.
   * Role is strictly set to UserRole.MANAGER server-side.
   */
  async createManager(data: {
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
        role: UserRole.MANAGER,
        isActive: true,
        mustChangePassword: true,
        emailVerified: true,
      },
    });
  }

  /**
   * Update permitted fields for a Manager scoped to the business.
   */
  async updateManager(
    managerUuid: string,
    businessUuid: string,
    data: { fullName?: string; email?: string; phone?: string },
  ): Promise<User | null> {
    const existing = await prisma.user.findFirst({
      where: {
        userUuid: managerUuid,
        businessUuid,
        role: UserRole.MANAGER,
        deletedAt: null,
      },
    });

    if (!existing) return null;

    return prisma.user.update({
      where: { userUuid: managerUuid },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Reset manager password and revoke active sessions.
   */
  async resetManagerPassword(
    managerUuid: string,
    businessUuid: string,
    passwordHash: string,
  ): Promise<User | null> {
    const existing = await prisma.user.findFirst({
      where: {
        userUuid: managerUuid,
        businessUuid,
        role: UserRole.MANAGER,
        deletedAt: null,
      },
    });

    if (!existing) return null;

    const [updated] = await Promise.all([
      prisma.user.update({
        where: { userUuid: managerUuid },
        data: {
          passwordHash,
          mustChangePassword: true,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          updatedAt: new Date(),
        },
      }),
      prisma.userSession.updateMany({
        where: { userUuid: managerUuid, isValid: true },
        data: { isValid: false },
      }),
      prisma.refreshToken.updateMany({
        where: { userUuid: managerUuid, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    return updated;
  }

  /**
   * Activate or Deactivate a Manager.
   * If deactivating, revokes all active sessions and refresh tokens immediately.
   */
  async updateManagerStatus(
    managerUuid: string,
    businessUuid: string,
    isActive: boolean,
  ): Promise<User | null> {
    const existing = await prisma.user.findFirst({
      where: {
        userUuid: managerUuid,
        businessUuid,
        role: UserRole.MANAGER,
        deletedAt: null,
      },
    });

    if (!existing) return null;

    const updated = await prisma.user.update({
      where: { userUuid: managerUuid },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });

    if (!isActive) {
      await Promise.all([
        prisma.userSession.updateMany({
          where: { userUuid: managerUuid, isValid: true },
          data: { isValid: false },
        }),
        prisma.refreshToken.updateMany({
          where: { userUuid: managerUuid, isRevoked: false },
          data: { isRevoked: true },
        }),
      ]);
    }

    return updated;
  }

  /**
   * Soft-delete a Manager (sets deletedAt, isActive=false, revokes active sessions and tokens).
   */
  async softDeleteManager(managerUuid: string, businessUuid: string): Promise<User | null> {
    const existing = await prisma.user.findFirst({
      where: {
        userUuid: managerUuid,
        businessUuid,
        role: UserRole.MANAGER,
        deletedAt: null,
      },
    });

    if (!existing) return null;

    const [deleted] = await Promise.all([
      prisma.user.update({
        where: { userUuid: managerUuid },
        data: {
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date(),
        },
      }),
      prisma.userSession.updateMany({
        where: { userUuid: managerUuid, isValid: true },
        data: { isValid: false },
      }),
      prisma.refreshToken.updateMany({
        where: { userUuid: managerUuid, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    return deleted;
  }

  /**
   * Record an audit log entry for Manager operations.
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
          oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : undefined,
          newValues: data.newValues ? JSON.parse(JSON.stringify(data.newValues)) : undefined,
          ipAddress: data.ipAddress,
        },
      });
    } catch {
      // Audit log failures should not block the primary transaction
    }
  }
}
