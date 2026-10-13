import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { WaiterService } from './waiter.service';
import { WaiterRepository } from './waiter.repository';
import { prisma } from '../../config/prisma';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../common/errors/app-error';
import { UserRole } from '@orderup/shared';

vi.mock('../../config/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      count: vi.fn(),
    },
    userSession: {
      updateMany: vi.fn(),
    },
    refreshToken: {
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$waiter_hashed_password'),
  },
}));

describe('WaiterService Unit Tests', () => {
  let waiterService: WaiterService;
  let mockWaiterRepository: WaiterRepository;

  const mockAdminUser = {
    userUuid: 'admin-uuid-1',
    role: UserRole.ADMIN,
    isActive: true,
    businessUuid: 'biz-uuid-1',
    business: {
      businessUuid: 'biz-uuid-1',
      isActive: true,
      deletedAt: null,
    },
  };

  const mockWaiterDetail = {
    waiterUuid: 'waiter-uuid-1',
    fullName: 'Alice Waiter',
    email: 'alice@example.com',
    phone: '0712345678',
    role: UserRole.WAITER,
    isActive: true,
    emailVerified: true,
    mustChangePassword: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: '2026-01-02T00:00:00.000Z',
    activitySummary: {
      lastLoginAt: '2026-01-02T00:00:00.000Z',
      mustChangePassword: true,
      accountAgeDays: 30,
      ordersClaimed: 12,
      ordersCompleted: 10,
      activeOrders: 2,
    },
    business: {
      id: 'biz-uuid-1',
      name: 'Test Bistro',
      slug: 'test-bistro',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWaiterRepository = new WaiterRepository();
    waiterService = new WaiterService(mockWaiterRepository);
  });

  // ──────────────────────────────────────────────
  // SECTION 1: Live ADMIN Validation
  // ──────────────────────────────────────────────

  describe('Live ADMIN Validation & Tenant Scope', () => {
    it('should throw UnauthorizedError if admin user is not found in DB', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(waiterService.getWaiters('ghost-user', {})).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('should throw UnauthorizedError if admin account is deactivated', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        isActive: false,
      } as any);

      await expect(waiterService.getWaiters('admin-uuid-1', {})).rejects.toThrow(
        'Your account has been deactivated',
      );
    });

    it('should throw ForbiddenError if role is MANAGER (not ADMIN)', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        role: UserRole.MANAGER,
      } as any);

      await expect(waiterService.getWaiters('admin-uuid-1', {})).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('should throw ForbiddenError if role is WAITER', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        role: UserRole.WAITER,
      } as any);

      await expect(waiterService.getWaiters('admin-uuid-1', {})).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('should throw ForbiddenError if role is CUSTOMER', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        role: UserRole.CUSTOMER,
      } as any);

      await expect(waiterService.getWaiters('admin-uuid-1', {})).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('should throw ForbiddenError if business is inactive', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        business: { businessUuid: 'biz-uuid-1', isActive: false, deletedAt: null },
      } as any);

      await expect(waiterService.getWaiters('admin-uuid-1', {})).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('should throw ForbiddenError if business is soft-deleted', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        business: {
          businessUuid: 'biz-uuid-1',
          isActive: true,
          deletedAt: new Date(),
        },
      } as any);

      await expect(waiterService.getWaiters('admin-uuid-1', {})).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('should throw UnauthorizedError if admin is soft-deleted (deletedAt set)', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null); // soft-deleted excluded by where clause

      await expect(waiterService.getWaiters('admin-uuid-1', {})).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  // ──────────────────────────────────────────────
  // SECTION 2: getWaiters (List, Sort, KPIs)
  // ──────────────────────────────────────────────

  describe('getWaiters (List with KPIs and Activity)', () => {
    it('should return paginated waiters with KPIs and activity summary', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiters').mockResolvedValue({
        waiters: [mockWaiterDetail],
        summary: {
          totalWaiters: 1,
          activeWaiters: 1,
          inactiveWaiters: 0,
          totalOrdersHandled: 12,
        },
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      const result = await waiterService.getWaiters('admin-uuid-1', {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(mockWaiterRepository.findWaiters).toHaveBeenCalledWith(
        'biz-uuid-1',
        expect.objectContaining({ page: 1, sortBy: 'createdAt', sortOrder: 'desc' }),
      );
      expect(result.waiters).toHaveLength(1);
      expect(result.summary.totalWaiters).toBe(1);
      expect(result.summary.totalOrdersHandled).toBe(12);
      expect(result.waiters[0].activitySummary.ordersClaimed).toBe(12);
      expect(result.waiters[0].activitySummary.ordersCompleted).toBe(10);
      expect(result.waiters[0].activitySummary.activeOrders).toBe(2);
    });
  });

  // ──────────────────────────────────────────────
  // SECTION 3: getWaiterById
  // ──────────────────────────────────────────────

  describe('getWaiterById', () => {
    it('should return single waiter detail when found in admin business', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(
        mockWaiterDetail,
      );

      const result = await waiterService.getWaiterById(
        'admin-uuid-1',
        'waiter-uuid-1',
      );

      expect(mockWaiterRepository.findWaiterById).toHaveBeenCalledWith(
        'waiter-uuid-1',
        'biz-uuid-1',
      );
      expect(result.waiterUuid).toBe('waiter-uuid-1');
    });

    it('Admin A cannot retrieve Waiter from another business — returns 404', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(null);

      await expect(
        waiterService.getWaiterById('admin-uuid-1', 'other-biz-waiter'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ──────────────────────────────────────────────
  // SECTION 4: createWaiter
  // ──────────────────────────────────────────────

  describe('createWaiter', () => {
    it('should hash password, enforce WAITER role, set businessUuid, and record WAITER_CREATED audit', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findUserByEmail').mockResolvedValue(null);
      vi.spyOn(mockWaiterRepository, 'createWaiter').mockResolvedValue({
        userUuid: 'new-waiter-uuid',
        fullName: 'Bob Waiter',
        email: 'bob@example.com',
        phone: null,
        role: UserRole.WAITER,
        isActive: true,
      } as any);
      vi.spyOn(mockWaiterRepository, 'createAuditLog').mockResolvedValue();
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue({
        ...mockWaiterDetail,
        waiterUuid: 'new-waiter-uuid',
        fullName: 'Bob Waiter',
        email: 'bob@example.com',
      });

      const result = await waiterService.createWaiter(
        'admin-uuid-1',
        {
          fullName: 'Bob Waiter',
          email: 'bob@example.com',
          password: 'SecurePass123!',
        },
        '127.0.0.1',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12);
      expect(mockWaiterRepository.createWaiter).toHaveBeenCalledWith(
        expect.objectContaining({
          businessUuid: 'biz-uuid-1',
          fullName: 'Bob Waiter',
          email: 'bob@example.com',
          passwordHash: '$2b$12$waiter_hashed_password',
        }),
      );
      expect(mockWaiterRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'WAITER_CREATED',
          businessUuid: 'biz-uuid-1',
          entityUuid: 'new-waiter-uuid',
        }),
      );
      expect(result.waiterUuid).toBe('new-waiter-uuid');
    });

    it('Admin cannot create a waiter for another business — businessUuid is always from live DB', async () => {
      // Admin only belongs to biz-uuid-1; cannot supply different businessUuid
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        businessUuid: 'biz-uuid-1', // always forced from DB
      } as any);
      vi.spyOn(mockWaiterRepository, 'findUserByEmail').mockResolvedValue(null);
      vi.spyOn(mockWaiterRepository, 'createWaiter').mockResolvedValue({
        userUuid: 'created-uuid',
        businessUuid: 'biz-uuid-1', // DB-enforced, never from client
        role: UserRole.WAITER,
      } as any);
      vi.spyOn(mockWaiterRepository, 'createAuditLog').mockResolvedValue();
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(mockWaiterDetail);

      await waiterService.createWaiter('admin-uuid-1', {
        fullName: 'Eve',
        email: 'eve@example.com',
        password: 'pass123',
      });

      expect(mockWaiterRepository.createWaiter).toHaveBeenCalledWith(
        expect.objectContaining({ businessUuid: 'biz-uuid-1' }),
      );
    });

    it('should throw ConflictError on duplicate email', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findUserByEmail').mockResolvedValue({
        userUuid: 'existing-user',
      } as any);

      await expect(
        waiterService.createWaiter('admin-uuid-1', {
          fullName: 'Duplicate',
          email: 'alice@example.com',
          password: 'pass123',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  // ──────────────────────────────────────────────
  // SECTION 5: updateWaiter
  // ──────────────────────────────────────────────

  describe('updateWaiter', () => {
    it('should update permitted fields only and record WAITER_UPDATED audit', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById')
        .mockResolvedValueOnce(mockWaiterDetail)
        .mockResolvedValueOnce({ ...mockWaiterDetail, fullName: 'Alice Updated' });
      vi.spyOn(mockWaiterRepository, 'updateWaiter').mockResolvedValue({} as any);
      vi.spyOn(mockWaiterRepository, 'createAuditLog').mockResolvedValue();

      const result = await waiterService.updateWaiter(
        'admin-uuid-1',
        'waiter-uuid-1',
        { fullName: 'Alice Updated' },
        '127.0.0.1',
      );

      expect(mockWaiterRepository.updateWaiter).toHaveBeenCalledWith(
        'waiter-uuid-1',
        'biz-uuid-1',
        { fullName: 'Alice Updated' },
      );
      expect(mockWaiterRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAITER_UPDATED' }),
      );
      expect(result.fullName).toBe('Alice Updated');
    });

    it('Admin A cannot update Waiter from another business — returns 404', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(null);

      await expect(
        waiterService.updateWaiter('admin-uuid-1', 'other-biz-waiter', {
          fullName: 'Hack',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ──────────────────────────────────────────────
  // SECTION 6: resetWaiterPassword
  // ──────────────────────────────────────────────

  describe('resetWaiterPassword', () => {
    it('should hash new password, set mustChangePassword, revoke sessions, and record audit', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(
        mockWaiterDetail,
      );
      vi.spyOn(mockWaiterRepository, 'resetWaiterPassword').mockResolvedValue(
        {} as any,
      );
      vi.spyOn(mockWaiterRepository, 'createAuditLog').mockResolvedValue();

      const result = await waiterService.resetWaiterPassword(
        'admin-uuid-1',
        'waiter-uuid-1',
        { temporaryPassword: 'TempPass999!' },
        '127.0.0.1',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('TempPass999!', 12);
      expect(mockWaiterRepository.resetWaiterPassword).toHaveBeenCalledWith(
        'waiter-uuid-1',
        'biz-uuid-1',
        '$2b$12$waiter_hashed_password',
      );
      expect(mockWaiterRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'WAITER_PASSWORD_RESET_INITIATED',
          entityUuid: 'waiter-uuid-1',
        }),
      );
      expect(result.temporaryPassword).toBe('TempPass999!');
      expect(result.waiterUuid).toBe('waiter-uuid-1');
    });

    it('Password reset result should NEVER contain passwordHash or tokens', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(
        mockWaiterDetail,
      );
      vi.spyOn(mockWaiterRepository, 'resetWaiterPassword').mockResolvedValue(
        {} as any,
      );
      vi.spyOn(mockWaiterRepository, 'createAuditLog').mockResolvedValue();

      const result = await waiterService.resetWaiterPassword(
        'admin-uuid-1',
        'waiter-uuid-1',
        {},
      );

      expect((result as any).passwordHash).toBeUndefined();
      expect((result as any).token).toBeUndefined();
      expect((result as any).resetPasswordToken).toBeUndefined();
    });

    it('Admin A cannot reset password for Waiter from another business — returns 404', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(null);

      await expect(
        waiterService.resetWaiterPassword('admin-uuid-1', 'other-biz-waiter', {}),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ──────────────────────────────────────────────
  // SECTION 7: setWaiterStatus
  // ──────────────────────────────────────────────

  describe('setWaiterStatus (Activate / Deactivate)', () => {
    it('should deactivate waiter and record WAITER_DEACTIVATED audit', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(
        mockWaiterDetail,
      );
      vi.spyOn(mockWaiterRepository, 'updateWaiterStatus').mockResolvedValue(
        {} as any,
      );
      vi.spyOn(mockWaiterRepository, 'createAuditLog').mockResolvedValue();

      const result = await waiterService.setWaiterStatus(
        'admin-uuid-1',
        'waiter-uuid-1',
        false,
        '127.0.0.1',
      );

      expect(mockWaiterRepository.updateWaiterStatus).toHaveBeenCalledWith(
        'waiter-uuid-1',
        'biz-uuid-1',
        false,
      );
      expect(mockWaiterRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAITER_DEACTIVATED' }),
      );
      expect(result.isActive).toBe(false);
    });

    it('should activate waiter and record WAITER_ACTIVATED audit', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue({
        ...mockWaiterDetail,
        isActive: false,
      });
      vi.spyOn(mockWaiterRepository, 'updateWaiterStatus').mockResolvedValue(
        {} as any,
      );
      vi.spyOn(mockWaiterRepository, 'createAuditLog').mockResolvedValue();

      const result = await waiterService.setWaiterStatus(
        'admin-uuid-1',
        'waiter-uuid-1',
        true,
        '127.0.0.1',
      );

      expect(mockWaiterRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAITER_ACTIVATED' }),
      );
      expect(result.isActive).toBe(true);
    });

    it('Admin A cannot deactivate Waiter from another business — returns 404', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(null);

      await expect(
        waiterService.setWaiterStatus('admin-uuid-1', 'other-biz-waiter', false),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ──────────────────────────────────────────────
  // SECTION 8: deleteWaiter
  // ──────────────────────────────────────────────

  describe('deleteWaiter (Soft Delete)', () => {
    it('should soft-delete waiter, revoke sessions, and record WAITER_DELETED audit', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(
        mockWaiterDetail,
      );
      vi.spyOn(mockWaiterRepository, 'softDeleteWaiter').mockResolvedValue(
        {} as any,
      );
      vi.spyOn(mockWaiterRepository, 'createAuditLog').mockResolvedValue();

      const result = await waiterService.deleteWaiter(
        'admin-uuid-1',
        'waiter-uuid-1',
        '127.0.0.1',
      );

      expect(mockWaiterRepository.softDeleteWaiter).toHaveBeenCalledWith(
        'waiter-uuid-1',
        'biz-uuid-1',
      );
      expect(mockWaiterRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAITER_DELETED' }),
      );
      expect(result.message).toContain('removed successfully');
    });

    it('Admin A cannot delete Waiter from another business — returns 404', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockWaiterRepository, 'findWaiterById').mockResolvedValue(null);

      await expect(
        waiterService.deleteWaiter('admin-uuid-1', 'other-biz-waiter'),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
