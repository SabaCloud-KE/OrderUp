import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
import { prisma } from '../../config/prisma';
import * as dashboardRepo from './dashboard.repository';
import { UnauthorizedError, ForbiddenError } from '../../common/errors/app-error';

vi.mock('../../config/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('./dashboard.repository', () => ({
  getDayRange: vi.fn(() => ({ start: new Date(), end: new Date() })),
  getDayRevenue: vi.fn(),
  getDayOrderCount: vi.fn(),
  getTodayOrderStatusCounts: vi.fn(),
  getStaffCounts: vi.fn(),
  getRecentOrders: vi.fn(),
  getTopMenuItems: vi.fn(),
  getSalesTrend: vi.fn(),
  getTableUtilization: vi.fn().mockResolvedValue({
    activeTables: 0,
    tablesUsedToday: 0,
    utilizationRate: 0,
  }),
  getPendingOrderAges: vi.fn().mockResolvedValue({
    totalPending: 0,
    oldestAgeMinutes: 0,
    ordersOver5Min: 0,
    ordersOver10Min: 0,
  }),
}));

describe('DashboardService Unit Tests', () => {
  let dashboardService: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    dashboardService = new DashboardService();
  });

  it('should throw UnauthorizedError when user does not exist', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    await expect(dashboardService.getAdminOverview('user-missing')).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('should throw UnauthorizedError when user is deactivated', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      userUuid: 'user-inactive',
      role: 'ADMIN',
      isActive: false,
      businessUuid: 'biz-1',
      business: {
        businessUuid: 'biz-1',
        name: 'The Alchemist',
        slug: 'the-alchemist',
        businessType: 'CLUB',
        city: 'Nairobi',
        county: 'Nairobi',
        status: 'ACTIVE',
        isActive: true,
        deletedAt: null,
      },
    } as any);

    await expect(dashboardService.getAdminOverview('user-inactive')).rejects.toThrow(
      'Your account has been deactivated',
    );
  });

  it('should throw ForbiddenError when user role is not ADMIN', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      userUuid: 'user-manager',
      role: 'MANAGER',
      isActive: true,
      businessUuid: 'biz-1',
      business: {
        businessUuid: 'biz-1',
        name: 'The Alchemist',
        slug: 'the-alchemist',
        businessType: 'CLUB',
        city: 'Nairobi',
        county: 'Nairobi',
        status: 'ACTIVE',
        isActive: true,
        deletedAt: null,
      },
    } as any);

    await expect(dashboardService.getAdminOverview('user-manager')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('should throw ForbiddenError when user has no active business', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      userUuid: 'user-no-biz',
      role: 'ADMIN',
      isActive: true,
      businessUuid: null,
      business: null,
    } as any);

    await expect(dashboardService.getAdminOverview('user-no-biz')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('should return complete AdminDashboardOverview with safe null percentageChange when previousDay is 0', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      userUuid: 'user-admin-1',
      role: 'ADMIN',
      isActive: true,
      businessUuid: 'biz-1',
      business: {
        businessUuid: 'biz-1',
        name: 'The Alchemist',
        slug: 'the-alchemist',
        businessType: 'CLUB',
        city: 'Nairobi',
        county: 'Nairobi',
        status: 'ACTIVE',
        isActive: true,
        deletedAt: null,
      },
    } as any);

    vi.mocked(dashboardRepo.getDayRevenue).mockResolvedValueOnce(5000).mockResolvedValueOnce(0);
    vi.mocked(dashboardRepo.getDayOrderCount).mockResolvedValueOnce(10).mockResolvedValueOnce(0);
    vi.mocked(dashboardRepo.getTodayOrderStatusCounts).mockResolvedValue({
      pending: 2,
      inProgress: 3,
      completed: 4,
      cancelled: 1,
      total: 10,
    });
    vi.mocked(dashboardRepo.getStaffCounts).mockResolvedValue({
      totalManagers: 2,
      totalWaiters: 5,
    });
    vi.mocked(dashboardRepo.getRecentOrders).mockResolvedValue([]);
    vi.mocked(dashboardRepo.getTopMenuItems).mockResolvedValue([]);
    vi.mocked(dashboardRepo.getSalesTrend).mockResolvedValue([]);

    const result = await dashboardService.getAdminOverview('user-admin-1');

    expect(result.business.id).toBe('biz-1');
    expect(result.business.name).toBe('The Alchemist');
    expect(result.summary.todayRevenue).toBe(5000);
    expect(result.summary.todayOrders).toBe(10);
    expect(result.summary.pendingOrders).toBe(2);
    expect(result.summary.inProgressOrders).toBe(3);
    expect(result.summary.completedOrders).toBe(4);
    expect(result.summary.cancelledOrders).toBe(1);
    expect(result.summary.totalManagers).toBe(2);
    expect(result.summary.totalWaiters).toBe(5);

    // Safe zero handling
    expect(result.revenue.today).toBe(5000);
    expect(result.revenue.previousDay).toBe(0);
    expect(result.revenue.percentageChange).toBeNull();

    expect(result.orders.today).toBe(10);
    expect(result.orders.previousDay).toBe(0);
    expect(result.orders.percentageChange).toBeNull();
  });

  it('should calculate percentage change correctly when previousDay > 0', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      userUuid: 'user-admin-1',
      role: 'ADMIN',
      isActive: true,
      businessUuid: 'biz-1',
      business: {
        businessUuid: 'biz-1',
        name: 'The Alchemist',
        slug: 'the-alchemist',
        businessType: 'CLUB',
        city: 'Nairobi',
        county: 'Nairobi',
        status: 'ACTIVE',
        isActive: true,
        deletedAt: null,
      },
    } as any);

    // Today 6000, Yesterday 4000 -> +50.0%
    vi.mocked(dashboardRepo.getDayRevenue).mockResolvedValueOnce(6000).mockResolvedValueOnce(4000);
    // Today 8, Yesterday 10 -> -20.0%
    vi.mocked(dashboardRepo.getDayOrderCount).mockResolvedValueOnce(8).mockResolvedValueOnce(10);
    vi.mocked(dashboardRepo.getTodayOrderStatusCounts).mockResolvedValue({
      pending: 0,
      inProgress: 0,
      completed: 8,
      cancelled: 0,
      total: 8,
    });
    vi.mocked(dashboardRepo.getStaffCounts).mockResolvedValue({
      totalManagers: 1,
      totalWaiters: 2,
    });
    vi.mocked(dashboardRepo.getRecentOrders).mockResolvedValue([]);
    vi.mocked(dashboardRepo.getTopMenuItems).mockResolvedValue([]);
    vi.mocked(dashboardRepo.getSalesTrend).mockResolvedValue([]);

    const result = await dashboardService.getAdminOverview('user-admin-1');

    expect(result.revenue.percentageChange).toBe(50);
    expect(result.orders.percentageChange).toBe(-20);
  });
});
