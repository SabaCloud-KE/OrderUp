/**
 * Dashboard Service
 *
 * Orchestrates repository calls and applies business logic:
 *   - Live user & business validation (rejects deactivated/suspended users or revoked business assignments)
 *   - Parallel data fetching for performance
 *   - Accurate revenue recognition based on paidAt timestamp
 *   - Safe percentage change calculation (returns null when previousDay = 0)
 *   - Combines all results into the AdminDashboardOverview response type
 */

import { prisma } from '../../config/prisma';
import { ForbiddenError, UnauthorizedError } from '../../common/errors/app-error';
import {
  AdminDashboardOverview,
  DashboardTrendComparison,
} from './dashboard.interface';
import {
  getDayRange,
  getDayRevenue,
  getDayOrderCount,
  getTodayOrderStatusCounts,
  getStaffCounts,
  getRecentOrders,
  getTopMenuItems,
  getSalesTrend,
  getTableUtilization,
  getPendingOrderAges,
} from './dashboard.repository';

export class DashboardService {
  /**
   * Build the complete Admin Dashboard Overview for the authenticated user.
   *
   * @param userId - Extracted server-side from verified JWT.
   */
  async getAdminOverview(userId: string): Promise<AdminDashboardOverview> {
    // 1. Validate live user record, active status, role, and current business assignment
    const user = await prisma.user.findFirst({
      where: {
        userUuid: userId,
        deletedAt: null,
      },
      select: {
        userUuid: true,
        role: true,
        isActive: true,
        businessUuid: true,
        business: {
          select: {
            businessUuid: true,
            name: true,
            slug: true,
            businessType: true,
            city: true,
            county: true,
            status: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found or has been deleted. Please log in again.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact your platform administrator.');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Insufficient permissions: User is not an active Business Administrator.');
    }

    if (!user.businessUuid || !user.business || !user.business.isActive || user.business.deletedAt !== null) {
      throw new ForbiddenError(
        'Your account is not associated with an active business. Please contact your platform administrator.',
      );
    }

    const business = user.business;
    const businessUuid = user.businessUuid;

    // 2. Compute date ranges
    const todayRange = getDayRange(0);
    const yesterdayRange = getDayRange(1);

    // 3. Fetch all metrics in parallel — no sequential blocking
    const [
      todayRevenue,
      yesterdayRevenue,
      todayOrderCount,
      yesterdayOrderCount,
      statusCounts,
      staffCounts,
      recentOrders,
      topMenuItems,
      salesTrend,
      tableUtilization,
      pendingOrderAge,
    ] = await Promise.all([
      getDayRevenue(businessUuid, todayRange),
      getDayRevenue(businessUuid, yesterdayRange),
      getDayOrderCount(businessUuid, todayRange),
      getDayOrderCount(businessUuid, yesterdayRange),
      getTodayOrderStatusCounts(businessUuid, todayRange),
      getStaffCounts(businessUuid),
      getRecentOrders(businessUuid),
      getTopMenuItems(businessUuid),
      getSalesTrend(businessUuid),
      getTableUtilization(businessUuid, todayRange),
      getPendingOrderAges(businessUuid),
    ]);

    // 4. Build trend comparisons with safe percentage calculation
    const revenueTrend = buildTrendComparison(todayRevenue, yesterdayRevenue);
    const ordersTrend = buildTrendComparison(todayOrderCount, yesterdayOrderCount);

    return {
      business: {
        id: business.businessUuid,
        name: business.name,
        type: business.businessType,
        slug: business.slug,
        city: business.city,
        county: business.county,
        status: business.status,
      },
      summary: {
        todayRevenue,
        todayOrders: todayOrderCount,
        pendingOrders: statusCounts.pending,
        inProgressOrders: statusCounts.inProgress,
        completedOrders: statusCounts.completed,
        cancelledOrders: statusCounts.cancelled,
        totalManagers: staffCounts.totalManagers,
        totalWaiters: staffCounts.totalWaiters,
      },
      revenue: revenueTrend,
      orders: ordersTrend,
      recentOrders,
      topMenuItems,
      salesTrend,
      tableUtilization,
      pendingOrderAge,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate percentage change between two values.
 *
 * Returns null (not Infinity or NaN) when previousDay is 0.
 * This prevents division-by-zero and invalid frontend display.
 *
 * The frontend renders null as "—" or "New" rather than a numeric badge.
 */
function buildTrendComparison(today: number, previousDay: number): DashboardTrendComparison {
  let percentageChange: number | null = null;

  if (previousDay > 0) {
    const raw = ((today - previousDay) / previousDay) * 100;
    // Round to 1 decimal place
    percentageChange = Math.round(raw * 10) / 10;
  }
  // When previousDay = 0 and today > 0: "new activity" — not mathematically comparable
  // When both = 0: no change to show

  return { today, previousDay, percentageChange };
}
