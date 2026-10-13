import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { ManagerService } from './manager.service';
import { ManagerRepository } from './manager.repository';
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
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpasswordmock'),
  },
}));

describe('ManagerService Unit Tests', () => {
  let managerService: ManagerService;
  let mockManagerRepository: ManagerRepository;

  const mockAdminUser = {
    userUuid: 'admin-user-uuid-1',
    role: UserRole.ADMIN,
    isActive: true,
    businessUuid: 'biz-uuid-1',
    business: {
      businessUuid: 'biz-uuid-1',
      isActive: true,
      deletedAt: null,
    },
  };

  const mockManagerDetail = {
    managerUuid: 'manager-user-uuid-1',
    userUuid: 'manager-user-uuid-1',
    fullName: 'Jane Manager',
    email: 'jane@example.com',
    phone: '0712345678',
    role: UserRole.MANAGER,
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
    },
    business: {
      id: 'biz-uuid-1',
      name: 'Test Business',
      slug: 'test-business',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockManagerRepository = new ManagerRepository();
    managerService = new ManagerService(mockManagerRepository);
  });

  describe('validateActingAdmin & Tenant Isolation', () => {
    it('should throw UnauthorizedError if admin user is not found', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(
        managerService.getManagers('non-existent-user', {}),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if admin user is deactivated', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        isActive: false,
      } as any);

      await expect(
        managerService.getManagers('admin-user-uuid-1', {}),
      ).rejects.toThrow('Your account has been deactivated');
    });

    it('should throw ForbiddenError if user is not an ADMIN (e.g. MANAGER role)', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        role: UserRole.MANAGER,
      } as any);

      await expect(
        managerService.getManagers('admin-user-uuid-1', {}),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError if admin business is inactive or deleted', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockAdminUser,
        business: {
          businessUuid: 'biz-uuid-1',
          isActive: false,
          deletedAt: null,
        },
      } as any);

      await expect(
        managerService.getManagers('admin-user-uuid-1', {}),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getManagers (List, Sort & KPIs)', () => {
    it('should return paginated managers with KPIs and activitySummary for the admin business', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findManagers').mockResolvedValue({
        managers: [mockManagerDetail],
        summary: {
          totalManagers: 1,
          activeManagers: 1,
          inactiveManagers: 0,
        },
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      const result = await managerService.getManagers('admin-user-uuid-1', {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(mockManagerRepository.findManagers).toHaveBeenCalledWith(
        'biz-uuid-1',
        expect.objectContaining({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
      );
      expect(result.managers).toHaveLength(1);
      expect(result.summary.totalManagers).toBe(1);
      expect(result.summary.activeManagers).toBe(1);
      expect(result.managers[0].activitySummary.accountAgeDays).toBe(30);
    });
  });

  describe('getManagerById', () => {
    it('should return single manager detail when found in same business', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findManagerById').mockResolvedValue(mockManagerDetail);

      const result = await managerService.getManagerById(
        'admin-user-uuid-1',
        'manager-user-uuid-1',
      );

      expect(mockManagerRepository.findManagerById).toHaveBeenCalledWith(
        'manager-user-uuid-1',
        'biz-uuid-1',
      );
      expect(result.managerUuid).toBe('manager-user-uuid-1');
    });

    it('should throw NotFoundError if manager does not exist or belongs to another business', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findManagerById').mockResolvedValue(null);

      await expect(
        managerService.getManagerById('admin-user-uuid-1', 'other-biz-manager'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('createManager', () => {
    it('should hash password, assign MANAGER role, and record audit log', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findUserByEmail').mockResolvedValue(null);
      vi.spyOn(mockManagerRepository, 'createManager').mockResolvedValue({
        userUuid: 'new-manager-uuid',
        fullName: 'New Manager',
        email: 'new@example.com',
        phone: '0700000000',
        role: UserRole.MANAGER,
        isActive: true,
      } as any);
      vi.spyOn(mockManagerRepository, 'createAuditLog').mockResolvedValue();
      vi.spyOn(mockManagerRepository, 'findManagerById').mockResolvedValue({
        ...mockManagerDetail,
        managerUuid: 'new-manager-uuid',
      });

      const result = await managerService.createManager(
        'admin-user-uuid-1',
        {
          fullName: 'New Manager',
          email: 'new@example.com',
          phone: '0700000000',
          password: 'Password123!',
        },
        '127.0.0.1',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(mockManagerRepository.createManager).toHaveBeenCalledWith(
        expect.objectContaining({
          businessUuid: 'biz-uuid-1',
          fullName: 'New Manager',
          email: 'new@example.com',
          passwordHash: '$2b$12$hashedpasswordmock',
        }),
      );
      expect(mockManagerRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          businessUuid: 'biz-uuid-1',
          action: 'MANAGER_CREATED',
          entityUuid: 'new-manager-uuid',
        }),
      );
      expect(result.managerUuid).toBe('new-manager-uuid');
    });

    it('should throw ConflictError if email is already taken', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findUserByEmail').mockResolvedValue({
        userUuid: 'existing-user-uuid',
        email: 'taken@example.com',
      } as any);

      await expect(
        managerService.createManager('admin-user-uuid-1', {
          fullName: 'Duplicate Email Manager',
          email: 'taken@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('updateManager', () => {
    it('should update permitted fields and record audit log', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findManagerById')
        .mockResolvedValueOnce(mockManagerDetail)
        .mockResolvedValueOnce({
          ...mockManagerDetail,
          fullName: 'Jane Updated',
        });
      vi.spyOn(mockManagerRepository, 'updateManager').mockResolvedValue({} as any);
      vi.spyOn(mockManagerRepository, 'createAuditLog').mockResolvedValue();

      const result = await managerService.updateManager(
        'admin-user-uuid-1',
        'manager-user-uuid-1',
        { fullName: 'Jane Updated' },
        '127.0.0.1',
      );

      expect(mockManagerRepository.updateManager).toHaveBeenCalledWith(
        'manager-user-uuid-1',
        'biz-uuid-1',
        { fullName: 'Jane Updated' },
      );
      expect(mockManagerRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          businessUuid: 'biz-uuid-1',
          action: 'MANAGER_UPDATED',
        }),
      );
      expect(result.fullName).toBe('Jane Updated');
    });
  });

  describe('resetManagerPassword', () => {
    it('should hash new password, reset mustChangePassword, revoke sessions, and record audit log', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findManagerById').mockResolvedValue(mockManagerDetail);
      vi.spyOn(mockManagerRepository, 'resetManagerPassword').mockResolvedValue({} as any);
      vi.spyOn(mockManagerRepository, 'createAuditLog').mockResolvedValue();

      const result = await managerService.resetManagerPassword(
        'admin-user-uuid-1',
        'manager-user-uuid-1',
        { temporaryPassword: 'NewTempPassword123!' },
        '127.0.0.1',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('NewTempPassword123!', 12);
      expect(mockManagerRepository.resetManagerPassword).toHaveBeenCalledWith(
        'manager-user-uuid-1',
        'biz-uuid-1',
        '$2b$12$hashedpasswordmock',
      );
      expect(mockManagerRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          businessUuid: 'biz-uuid-1',
          action: 'MANAGER_PASSWORD_RESET_INITIATED',
          entityUuid: 'manager-user-uuid-1',
        }),
      );
      expect(result.temporaryPassword).toBe('NewTempPassword123!');
      expect(result.managerUuid).toBe('manager-user-uuid-1');
    });

    it('should throw NotFoundError if manager does not belong to admin business', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findManagerById').mockResolvedValue(null);

      await expect(
        managerService.resetManagerPassword(
          'admin-user-uuid-1',
          'other-biz-manager',
          {},
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('setManagerStatus', () => {
    it('should activate or deactivate a manager and record audit log', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findManagerById').mockResolvedValue(mockManagerDetail);
      vi.spyOn(mockManagerRepository, 'updateManagerStatus').mockResolvedValue({} as any);
      vi.spyOn(mockManagerRepository, 'createAuditLog').mockResolvedValue();

      const result = await managerService.setManagerStatus(
        'admin-user-uuid-1',
        'manager-user-uuid-1',
        false,
        '127.0.0.1',
      );

      expect(mockManagerRepository.updateManagerStatus).toHaveBeenCalledWith(
        'manager-user-uuid-1',
        'biz-uuid-1',
        false,
      );
      expect(mockManagerRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MANAGER_DEACTIVATED',
        }),
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('deleteManager', () => {
    it('should soft-delete manager, revoke tokens, and record audit log', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.spyOn(mockManagerRepository, 'findManagerById').mockResolvedValue(mockManagerDetail);
      vi.spyOn(mockManagerRepository, 'softDeleteManager').mockResolvedValue({} as any);
      vi.spyOn(mockManagerRepository, 'createAuditLog').mockResolvedValue();

      const result = await managerService.deleteManager(
        'admin-user-uuid-1',
        'manager-user-uuid-1',
        '127.0.0.1',
      );

      expect(mockManagerRepository.softDeleteManager).toHaveBeenCalledWith(
        'manager-user-uuid-1',
        'biz-uuid-1',
      );
      expect(mockManagerRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MANAGER_DELETED',
        }),
      );
      expect(result.message).toContain('removed successfully');
    });
  });
});
