/**
 * Reporting Service
 *
 * Implements business logic for Admin reports and analytics:
 *   - Live database Admin & Business verification (no trust in stale JWT claims)
 *   - Accurate date range parsing with UTC boundaries & previous period calculation
 *   - Revenue recognition based on paymentStatus === 'PAID' and paidAt timestamp
 *   - Safe percentage calculations (no Infinity / NaN)
 *   - Daily trend population with zero-filling for missing dates
 *   - Safe CSV export with formula injection prevention
 *   - Audit logging on report exports
 */

import { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ForbiddenError, UnauthorizedError, BadRequestError } from '../../common/errors/app-error';
import { UserRole } from '@orderup/shared';
import { ReportingRepository } from './reporting.repository';
import {
  AdminExportQueryParams,
  AdminReportQueryParams,
  CategoryPerformanceReportDTO,
  OrderReportDTO,
  PaymentReportDTO,
  ProductPerformanceReportDTO,
  ReportDateRangeType,
  ReportOverviewDTO,
  ResolvedDateRange,
  RevenueReportDTO,
  WaiterPerformanceReportDTO,
} from './reporting.interface';

export class ReportingService {
  constructor(private reportingRepository: ReportingRepository = new ReportingRepository()) {}

  /**
   * Validate that the acting user is a live, active ADMIN assigned to an active business.
   */
  private async validateActingAdmin(adminUserId: string): Promise<{
    businessUuid: string;
    adminUserUuid: string;
  }> {
    const user = await prisma.user.findFirst({
      where: { userUuid: adminUserId, deletedAt: null },
      select: {
        userUuid: true,
        role: true,
        isActive: true,
        businessUuid: true,
        business: {
          select: {
            businessUuid: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError(
        'User account not found or has been deleted. Please log in again.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedError(
        'Your account has been deactivated. Please contact support.',
      );
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError(
        'Insufficient permissions: Only Business Administrators can access Reports.',
      );
    }

    if (
      !user.businessUuid ||
      !user.business ||
      !user.business.isActive ||
      user.business.deletedAt !== null
    ) {
      throw new ForbiddenError(
        'Your account is not associated with an active business. Please contact your platform administrator.',
      );
    }

    return {
      businessUuid: user.businessUuid,
      adminUserUuid: user.userUuid,
    };
  }

  /**
   * Resolve UTC date range boundaries for predefined and custom ranges.
   */
  public resolveDateRange(
    range: ReportDateRangeType = 'LAST_7_DAYS',
    customStart?: string,
    customEnd?: string,
  ): ResolvedDateRange {
    const now = new Date();
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth();
    const curDate = now.getUTCDate();
    const curDayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday

    let start: Date;
    let end: Date;

    switch (range) {
      case 'TODAY': {
        start = new Date(Date.UTC(curYear, curMonth, curDate, 0, 0, 0, 0));
        end = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));
        break;
      }
      case 'YESTERDAY': {
        start = new Date(Date.UTC(curYear, curMonth, curDate - 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(curYear, curMonth, curDate - 1, 23, 59, 59, 999));
        break;
      }
      case 'LAST_7_DAYS': {
        start = new Date(Date.UTC(curYear, curMonth, curDate - 6, 0, 0, 0, 0));
        end = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));
        break;
      }
      case 'LAST_30_DAYS': {
        start = new Date(Date.UTC(curYear, curMonth, curDate - 29, 0, 0, 0, 0));
        end = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));
        break;
      }
      case 'THIS_WEEK': {
        // Monday is day 1, Sunday is day 7
        const diffToMonday = (curDayOfWeek + 6) % 7;
        start = new Date(Date.UTC(curYear, curMonth, curDate - diffToMonday, 0, 0, 0, 0));
        end = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));
        break;
      }
      case 'LAST_WEEK': {
        const diffToMonday = (curDayOfWeek + 6) % 7;
        const lastWeekMonday = curDate - diffToMonday - 7;
        start = new Date(Date.UTC(curYear, curMonth, lastWeekMonday, 0, 0, 0, 0));
        end = new Date(Date.UTC(curYear, curMonth, lastWeekMonday + 6, 23, 59, 59, 999));
        break;
      }
      case 'THIS_MONTH': {
        start = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));
        break;
      }
      case 'LAST_MONTH': {
        start = new Date(Date.UTC(curYear, curMonth - 1, 1, 0, 0, 0, 0));
        // Day 0 of curMonth gives last day of curMonth - 1
        end = new Date(Date.UTC(curYear, curMonth, 0, 23, 59, 59, 999));
        break;
      }
      case 'CUSTOM': {
        if (!customStart || !customEnd) {
          throw new BadRequestError('Both startDate and endDate are required for CUSTOM range.');
        }
        const s = new Date(customStart);
        const e = new Date(customEnd);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) {
          throw new BadRequestError('Invalid date format provided for custom range.');
        }
        if (s > e) {
          throw new BadRequestError('startDate cannot be after endDate.');
        }
        start = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0, 0));
        end = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59, 999));
        break;
      }
      default: {
        start = new Date(Date.UTC(curYear, curMonth, curDate - 6, 0, 0, 0, 0));
        end = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));
        break;
      }
    }

    const durationMs = end.getTime() - start.getTime() + 1;
    const daysCount = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - durationMs + 1);

    return {
      start,
      end,
      previousStart,
      previousEnd,
      daysCount,
    };
  }

  /**
   * Safe percentage change calculation.
   * Returns null if previous period value is 0.
   */
  private calculatePercentageChange(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  /**
   * Generate an array of YYYY-MM-DD date strings between start and end inclusive.
   */
  private getDateList(start: Date, end: Date): string[] {
    const dates: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return dates;
  }

  /**
   * Escape a value safely for CSV export (prevents CSV formula injection).
   */
  private escapeCsvCell(val: any): string {
    if (val === null || val === undefined) return '';
    let str = String(val);
    // Formula injection prevention: prefix with single quote if starts with =, +, -, @, \t, \r
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. REPORT OVERVIEW
  // ─────────────────────────────────────────────────────────────

  async getAdminOverview(
    adminUserId: string,
    query: AdminReportQueryParams,
  ): Promise<ReportOverviewDTO> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);

    const [
      currentRevenue,
      previousRevenue,
      currentOrdersCount,
      previousOrdersCount,
      orderStatusGroups,
    ] = await Promise.all([
      this.reportingRepository.getRevenueForPeriod(businessUuid, range.start, range.end),
      this.reportingRepository.getRevenueForPeriod(businessUuid, range.previousStart, range.previousEnd),
      this.reportingRepository.getOrderCountForPeriod(businessUuid, range.start, range.end),
      this.reportingRepository.getOrderCountForPeriod(businessUuid, range.previousStart, range.previousEnd),
      this.reportingRepository.getOrderStatusGroups(businessUuid, range.start, range.end),
    ]);

    let completedOrders = 0;
    let cancelledOrders = 0;
    let ordersInProgress = 0;

    for (const group of orderStatusGroups) {
      if (group.status === OrderStatus.COMPLETED || group.status === OrderStatus.DELIVERED) {
        completedOrders += group._count.orderUuid;
      } else if (group.status === OrderStatus.CANCELLED) {
        cancelledOrders += group._count.orderUuid;
      } else if (
        group.status === OrderStatus.CLAIMED ||
        group.status === OrderStatus.PREPARING ||
        group.status === OrderStatus.READY
      ) {
        ordersInProgress += group._count.orderUuid;
      }
    }

    const averageOrderValue =
      completedOrders > 0 ? Math.round((currentRevenue / completedOrders) * 100) / 100 : 0;

    return {
      revenue: {
        totalRevenue: currentRevenue,
        previousPeriodRevenue: previousRevenue,
        percentageChange: this.calculatePercentageChange(currentRevenue, previousRevenue),
      },
      orders: {
        totalOrders: currentOrdersCount,
        completedOrders,
        cancelledOrders,
        ordersInProgress,
        previousPeriodOrders: previousOrdersCount,
        percentageChange: this.calculatePercentageChange(currentOrdersCount, previousOrdersCount),
      },
      averageOrderValue,
      dateRange: {
        range: query.range || 'LAST_7_DAYS',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. REVENUE ANALYTICS
  // ─────────────────────────────────────────────────────────────

  async getAdminRevenue(
    adminUserId: string,
    query: AdminReportQueryParams,
  ): Promise<RevenueReportDTO> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);

    const [currentRevenue, previousRevenue, paidPayments] = await Promise.all([
      this.reportingRepository.getRevenueForPeriod(businessUuid, range.start, range.end),
      this.reportingRepository.getRevenueForPeriod(businessUuid, range.previousStart, range.previousEnd),
      this.reportingRepository.getPaidPaymentsInRange(businessUuid, range.start, range.end),
    ]);

    // Aggregate daily revenue from paidAt
    const dailyMap: Record<string, number> = {};
    for (const p of paidPayments) {
      if (!p.paidAt) continue;
      const dateKey = p.paidAt.toISOString().split('T')[0];
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + Number(p.amount || 0);
    }

    const allDates = this.getDateList(range.start, range.end);
    const revenueTrend = allDates.map((date) => ({
      date,
      revenue: Math.round((dailyMap[date] || 0) * 100) / 100,
    }));

    let highestRevenueDay: { date: string; revenue: number } | null = null;
    let lowestRevenueDay: { date: string; revenue: number } | null = null;

    if (revenueTrend.length > 0) {
      let maxRev = -1;
      let minRev = Infinity;

      for (const item of revenueTrend) {
        if (item.revenue > maxRev) {
          maxRev = item.revenue;
          highestRevenueDay = item;
        }
        if (item.revenue < minRev) {
          minRev = item.revenue;
          lowestRevenueDay = item;
        }
      }
    }

    const averageDailyRevenue =
      range.daysCount > 0 ? Math.round((currentRevenue / range.daysCount) * 100) / 100 : 0;

    return {
      totalRevenue: currentRevenue,
      previousPeriodRevenue: previousRevenue,
      percentageChange: this.calculatePercentageChange(currentRevenue, previousRevenue),
      averageDailyRevenue,
      highestRevenueDay,
      lowestRevenueDay,
      revenueTrend,
      dateRange: {
        range: query.range || 'LAST_7_DAYS',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ORDER ANALYTICS
  // ─────────────────────────────────────────────────────────────

  async getAdminOrders(
    adminUserId: string,
    query: AdminReportQueryParams,
  ): Promise<OrderReportDTO> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);

    const [statusGroups, rawOrders] = await Promise.all([
      this.reportingRepository.getOrderStatusGroups(businessUuid, range.start, range.end),
      this.reportingRepository.getOrdersForTrend(businessUuid, range.start, range.end),
    ]);

    const totalOrders = rawOrders.length;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let pendingOrders = 0;
    let ordersInProgress = 0;

    const statusCountsMap: Record<string, number> = {};

    for (const group of statusGroups) {
      const count = group._count.orderUuid;
      statusCountsMap[group.status] = count;

      if (group.status === OrderStatus.COMPLETED || group.status === OrderStatus.DELIVERED) {
        completedOrders += count;
      } else if (group.status === OrderStatus.CANCELLED) {
        cancelledOrders += count;
      } else if (group.status === OrderStatus.PENDING) {
        pendingOrders += count;
      } else if (
        group.status === OrderStatus.CLAIMED ||
        group.status === OrderStatus.PREPARING ||
        group.status === OrderStatus.READY
      ) {
        ordersInProgress += count;
      }
    }

    const statusDistribution = Object.values(OrderStatus).map((status) => {
      const count = statusCountsMap[status] || 0;
      return {
        status,
        count,
        percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 1000) / 10 : 0,
      };
    });

    // Daily Trend
    const dailyMap: Record<string, { count: number; completedCount: number; cancelledCount: number; revenue: number }> = {};
    for (const order of rawOrders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { count: 0, completedCount: 0, cancelledCount: 0, revenue: 0 };
      }
      dailyMap[dateKey].count += 1;
      if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.DELIVERED) {
        dailyMap[dateKey].completedCount += 1;
        dailyMap[dateKey].revenue += Number(order.totalAmount || 0);
      } else if (order.status === OrderStatus.CANCELLED) {
        dailyMap[dateKey].cancelledCount += 1;
      }
    }

    const allDates = this.getDateList(range.start, range.end);
    const orderTrend = allDates.map((date) => ({
      date,
      count: dailyMap[date]?.count || 0,
      completedCount: dailyMap[date]?.completedCount || 0,
      cancelledCount: dailyMap[date]?.cancelledCount || 0,
      revenue: Math.round((dailyMap[date]?.revenue || 0) * 100) / 100,
    }));

    const averageOrdersPerDay =
      range.daysCount > 0 ? Math.round((totalOrders / range.daysCount) * 10) / 10 : 0;

    return {
      totalOrders,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      ordersInProgress,
      averageOrdersPerDay,
      orderTrend,
      statusDistribution,
      categoryDistribution: {
        pending: pendingOrders,
        inProgress: ordersInProgress,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
      dateRange: {
        range: query.range || 'LAST_7_DAYS',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. PAYMENT ANALYTICS
  // ─────────────────────────────────────────────────────────────

  async getAdminPayments(
    adminUserId: string,
    query: AdminReportQueryParams,
  ): Promise<PaymentReportDTO> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);

    const [totalSettledRevenue, { statusBreakdown, methodBreakdown, methodPaidRevenue }] =
      await Promise.all([
        this.reportingRepository.getRevenueForPeriod(businessUuid, range.start, range.end),
        this.reportingRepository.getPaymentAggregations(businessUuid, range.start, range.end),
      ]);

    let successfulPayments = 0;
    let pendingPayments = 0;
    let processingPayments = 0;
    let failedPayments = 0;
    let cancelledPayments = 0;
    let refundedPayments = 0;

    let totalPaymentCount = 0;
    const paymentStatusBreakdown = statusBreakdown.map((sb) => {
      const count = sb._count.paymentUuid;
      const amount = Number(sb._sum.amount || 0);
      totalPaymentCount += count;

      if (sb.paymentStatus === PaymentStatus.PAID) successfulPayments = count;
      else if (sb.paymentStatus === PaymentStatus.PENDING) pendingPayments = count;
      else if (sb.paymentStatus === PaymentStatus.PROCESSING) processingPayments = count;
      else if (sb.paymentStatus === PaymentStatus.FAILED) failedPayments = count;
      else if (sb.paymentStatus === PaymentStatus.CANCELLED) cancelledPayments = count;
      else if (sb.paymentStatus === PaymentStatus.REFUNDED) refundedPayments = count;

      return {
        status: sb.paymentStatus,
        count,
        amount,
        percentage: 0, // Computed below once total is known
      };
    });

    for (const item of paymentStatusBreakdown) {
      item.percentage =
        totalPaymentCount > 0 ? Math.round((item.count / totalPaymentCount) * 1000) / 10 : 0;
    }

    const methodRevenueMap: Record<string, number> = {};
    for (const mr of methodPaidRevenue) {
      methodRevenueMap[mr.paymentMethod] = Number(mr._sum.amount || 0);
    }

    const paymentMethodBreakdown = methodBreakdown.map((mb) => {
      const transactions = mb._count.paymentUuid;
      const revenue = methodRevenueMap[mb.paymentMethod] || 0;
      const percentage =
        totalSettledRevenue > 0
          ? Math.round((revenue / totalSettledRevenue) * 1000) / 10
          : 0;

      return {
        method: mb.paymentMethod,
        transactions,
        revenue,
        percentage,
      };
    });

    return {
      totalSettledRevenue,
      successfulPayments,
      pendingPayments,
      processingPayments,
      failedPayments,
      cancelledPayments,
      refundedPayments,
      paymentMethodBreakdown,
      paymentStatusBreakdown,
      dateRange: {
        range: query.range || 'LAST_7_DAYS',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 5. MENU & PRODUCT PERFORMANCE
  // ─────────────────────────────────────────────────────────────

  async getAdminProducts(
    adminUserId: string,
    query: AdminReportQueryParams,
  ): Promise<ProductPerformanceReportDTO> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);

    const { orderItems, allProducts } =
      await this.reportingRepository.getOrderItemsForProducts(
        businessUuid,
        range.start,
        range.end,
      );

    const productMap: Record<
      string,
      { productUuid: string; productName: string; category: string; quantitySold: number; revenue: number }
    > = {};

    let totalProductsSold = 0;
    let totalProductRevenue = 0;

    for (const item of orderItems) {
      const pUuid = item.productUuid;
      const pName = item.product?.name || 'Unknown Product';
      const catName = item.product?.category?.name || 'General';
      const qty = item.quantity || 1;
      const rev = Number(item.subtotal || Number(item.unitPrice || 0) * qty);

      if (!productMap[pUuid]) {
        productMap[pUuid] = {
          productUuid: pUuid,
          productName: pName,
          category: catName,
          quantitySold: 0,
          revenue: 0,
        };
      }

      productMap[pUuid].quantitySold += qty;
      productMap[pUuid].revenue += rev;
      totalProductsSold += qty;
      totalProductRevenue += rev;
    }

    // Include zero-sales products for complete visibility in bottom products
    for (const prod of allProducts) {
      if (!productMap[prod.productUuid]) {
        productMap[prod.productUuid] = {
          productUuid: prod.productUuid,
          productName: prod.name,
          category: prod.category?.name || 'General',
          quantitySold: 0,
          revenue: 0,
        };
      }
    }

    const allProductList = Object.values(productMap).map((p) => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
      percentageOfTotalRevenue:
        totalProductRevenue > 0
          ? Math.round((p.revenue / totalProductRevenue) * 1000) / 10
          : 0,
    }));

    allProductList.sort((a, b) => b.revenue - a.revenue || b.quantitySold - a.quantitySold);

    const topProducts = allProductList.slice(0, 10);
    const bottomProducts = allProductList.slice().reverse().slice(0, 10);

    return {
      topProducts,
      bottomProducts,
      totalProductsSold,
      totalProductRevenue: Math.round(totalProductRevenue * 100) / 100,
      dateRange: {
        range: query.range || 'LAST_7_DAYS',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 6. CATEGORY PERFORMANCE
  // ─────────────────────────────────────────────────────────────

  async getAdminCategories(
    adminUserId: string,
    query: AdminReportQueryParams,
  ): Promise<CategoryPerformanceReportDTO> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);

    const { orderItems } = await this.reportingRepository.getOrderItemsForProducts(
      businessUuid,
      range.start,
      range.end,
    );

    const categoryMap: Record<
      string,
      { categoryUuid: string; categoryName: string; quantitySold: number; revenue: number }
    > = {};

    let totalRevenue = 0;
    let totalQuantitySold = 0;

    for (const item of orderItems) {
      const catUuid = item.product?.category?.categoryUuid || 'uncategorized';
      const catName = item.product?.category?.name || 'Uncategorized';
      const qty = item.quantity || 1;
      const rev = Number(item.subtotal || Number(item.unitPrice || 0) * qty);

      if (!categoryMap[catUuid]) {
        categoryMap[catUuid] = {
          categoryUuid: catUuid,
          categoryName: catName,
          quantitySold: 0,
          revenue: 0,
        };
      }

      categoryMap[catUuid].quantitySold += qty;
      categoryMap[catUuid].revenue += rev;
      totalQuantitySold += qty;
      totalRevenue += rev;
    }

    const categories = Object.values(categoryMap).map((cat) => ({
      categoryUuid: cat.categoryUuid,
      categoryName: cat.categoryName,
      quantitySold: cat.quantitySold,
      revenue: Math.round(cat.revenue * 100) / 100,
      percentageOfRevenue:
        totalRevenue > 0 ? Math.round((cat.revenue / totalRevenue) * 1000) / 10 : 0,
    }));

    categories.sort((a, b) => b.revenue - a.revenue);

    return {
      categories,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalQuantitySold,
      dateRange: {
        range: query.range || 'LAST_7_DAYS',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 7. WAITER PERFORMANCE ANALYTICS
  // ─────────────────────────────────────────────────────────────

  async getAdminWaiters(
    adminUserId: string,
    query: AdminReportQueryParams,
  ): Promise<WaiterPerformanceReportDTO> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);

    const { waiters, orders } = await this.reportingRepository.getWaiterPerformanceData(
      businessUuid,
      range.start,
      range.end,
    );

    const waiterStatsMap: Record<
      string,
      {
        waiterUuid: string;
        fullName: string;
        email: string;
        ordersClaimed: number;
        ordersCompleted: number;
        ordersCancelled: number;
        activeOrders: number;
        revenueHandled: number;
        totalFulfillMs: number;
      }
    > = {};

    for (const w of waiters) {
      waiterStatsMap[w.userUuid] = {
        waiterUuid: w.userUuid,
        fullName: w.fullName,
        email: w.email,
        ordersClaimed: 0,
        ordersCompleted: 0,
        ordersCancelled: 0,
        activeOrders: 0,
        revenueHandled: 0,
        totalFulfillMs: 0,
      };
    }

    let totalOrdersClaimed = 0;
    let totalOrdersCompleted = 0;

    for (const o of orders) {
      if (!o.waiterUuid) continue;

      if (!waiterStatsMap[o.waiterUuid]) {
        waiterStatsMap[o.waiterUuid] = {
          waiterUuid: o.waiterUuid,
          fullName: 'Staff Member',
          email: '',
          ordersClaimed: 0,
          ordersCompleted: 0,
          ordersCancelled: 0,
          activeOrders: 0,
          revenueHandled: 0,
          totalFulfillMs: 0,
        };
      }

      const st = waiterStatsMap[o.waiterUuid];
      st.ordersClaimed += 1;
      totalOrdersClaimed += 1;

      if (o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED) {
        st.ordersCompleted += 1;
        totalOrdersCompleted += 1;
        st.revenueHandled += Number(o.totalAmount || 0);

        if (o.createdAt && o.updatedAt) {
          const diff = Math.max(0, o.updatedAt.getTime() - o.createdAt.getTime());
          st.totalFulfillMs += diff;
        }
      } else if (o.status === OrderStatus.CANCELLED) {
        st.ordersCancelled += 1;
      } else if (
        o.status === OrderStatus.CLAIMED ||
        o.status === OrderStatus.PREPARING ||
        o.status === OrderStatus.READY
      ) {
        st.activeOrders += 1;
      }
    }

    const waiterList = Object.values(waiterStatsMap).map((w) => {
      const completionRate =
        w.ordersClaimed > 0
          ? Math.round((w.ordersCompleted / w.ordersClaimed) * 1000) / 10
          : 0;

      const averageCompletionTimeMinutes =
        w.ordersCompleted > 0
          ? Math.round(w.totalFulfillMs / (w.ordersCompleted * 60 * 1000) * 10) / 10
          : 0;

      return {
        waiterUuid: w.waiterUuid,
        fullName: w.fullName,
        email: w.email,
        ordersClaimed: w.ordersClaimed,
        ordersCompleted: w.ordersCompleted,
        ordersCancelled: w.ordersCancelled,
        activeOrders: w.activeOrders,
        completionRate,
        revenueHandled: Math.round(w.revenueHandled * 100) / 100,
        averageCompletionTimeMinutes,
      };
    });

    waiterList.sort((a, b) => b.ordersCompleted - a.ordersCompleted || b.revenueHandled - a.revenueHandled);

    const overallCompletionRate =
      totalOrdersClaimed > 0
        ? Math.round((totalOrdersCompleted / totalOrdersClaimed) * 1000) / 10
        : 0;

    return {
      waiters: waiterList,
      totalOrdersClaimed,
      totalOrdersCompleted,
      overallCompletionRate,
      dateRange: {
        range: query.range || 'LAST_7_DAYS',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 8. REPORT EXPORT (CSV)
  // ─────────────────────────────────────────────────────────────

  async exportAdminReport(
    adminUserId: string,
    query: AdminExportQueryParams,
    ipAddress?: string,
  ): Promise<{ filename: string; csv: string }> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);

    const startStr = range.start.toISOString().split('T')[0];
    const endStr = range.end.toISOString().split('T')[0];
    const filename = `${query.reportType.toLowerCase()}-report-${startStr}-to-${endStr}.csv`;

    let csv = '';

    switch (query.reportType) {
      case 'REVENUE': {
        const data = await this.getAdminRevenue(adminUserId, query);
        csv += 'Metric,Value\n';
        csv += `Total Recognized Revenue,KES ${this.escapeCsvCell(data.totalRevenue)}\n`;
        csv += `Previous Period Revenue,KES ${this.escapeCsvCell(data.previousPeriodRevenue)}\n`;
        csv += `Percentage Change,${this.escapeCsvCell(data.percentageChange !== null ? `${data.percentageChange}%` : 'N/A')}\n`;
        csv += `Average Daily Revenue,KES ${this.escapeCsvCell(data.averageDailyRevenue)}\n`;
        csv += `Highest Revenue Day,${this.escapeCsvCell(data.highestRevenueDay?.date || 'N/A')} (KES ${this.escapeCsvCell(data.highestRevenueDay?.revenue || 0)})\n`;
        csv += `Lowest Revenue Day,${this.escapeCsvCell(data.lowestRevenueDay?.date || 'N/A')} (KES ${this.escapeCsvCell(data.lowestRevenueDay?.revenue || 0)})\n`;
        csv += '\nDate,Recognized Revenue (KES)\n';
        for (const pt of data.revenueTrend) {
          csv += `${this.escapeCsvCell(pt.date)},${this.escapeCsvCell(pt.revenue)}\n`;
        }
        break;
      }
      case 'ORDERS': {
        const data = await this.getAdminOrders(adminUserId, query);
        csv += 'Metric,Value\n';
        csv += `Total Orders Placed,${this.escapeCsvCell(data.totalOrders)}\n`;
        csv += `Completed Orders,${this.escapeCsvCell(data.completedOrders)}\n`;
        csv += `Cancelled Orders,${this.escapeCsvCell(data.cancelledOrders)}\n`;
        csv += `Pending Orders,${this.escapeCsvCell(data.pendingOrders)}\n`;
        csv += `Orders In Progress,${this.escapeCsvCell(data.ordersInProgress)}\n`;
        csv += `Average Orders Per Day,${this.escapeCsvCell(data.averageOrdersPerDay)}\n`;
        csv += '\nDate,Total Orders,Completed Orders,Cancelled Orders,Completed Revenue (KES)\n';
        for (const pt of data.orderTrend) {
          csv += `${this.escapeCsvCell(pt.date)},${this.escapeCsvCell(pt.count)},${this.escapeCsvCell(pt.completedCount)},${this.escapeCsvCell(pt.cancelledCount)},${this.escapeCsvCell(pt.revenue)}\n`;
        }
        csv += '\nOrder Status,Count,Percentage (%)\n';
        for (const s of data.statusDistribution) {
          csv += `${this.escapeCsvCell(s.status)},${this.escapeCsvCell(s.count)},${this.escapeCsvCell(s.percentage)}%\n`;
        }
        break;
      }
      case 'PAYMENTS': {
        const data = await this.getAdminPayments(adminUserId, query);
        csv += 'Payment Status Metric,Count\n';
        csv += `Total Settled Revenue (PAID),KES ${this.escapeCsvCell(data.totalSettledRevenue)}\n`;
        csv += `Successful (PAID) Payments,${this.escapeCsvCell(data.successfulPayments)}\n`;
        csv += `Pending Payments,${this.escapeCsvCell(data.pendingPayments)}\n`;
        csv += `Processing Payments,${this.escapeCsvCell(data.processingPayments)}\n`;
        csv += `Failed Payments,${this.escapeCsvCell(data.failedPayments)}\n`;
        csv += `Cancelled Payments,${this.escapeCsvCell(data.cancelledPayments)}\n`;
        csv += `Refunded Payments,${this.escapeCsvCell(data.refundedPayments)}\n`;
        csv += '\nPayment Method,Transactions,Paid Revenue (KES),Percentage of Revenue (%)\n';
        for (const m of data.paymentMethodBreakdown) {
          csv += `${this.escapeCsvCell(m.method)},${this.escapeCsvCell(m.transactions)},${this.escapeCsvCell(m.revenue)},${this.escapeCsvCell(m.percentage)}%\n`;
        }
        break;
      }
      case 'PRODUCTS': {
        const data = await this.getAdminProducts(adminUserId, query);
        csv += 'Product Name,Category,Quantity Sold,Revenue (KES),Percentage of Total (%)\n';
        for (const p of data.topProducts) {
          csv += `${this.escapeCsvCell(p.productName)},${this.escapeCsvCell(p.category)},${this.escapeCsvCell(p.quantitySold)},${this.escapeCsvCell(p.revenue)},${this.escapeCsvCell(p.percentageOfTotalRevenue)}%\n`;
        }
        break;
      }
      case 'CATEGORIES': {
        const data = await this.getAdminCategories(adminUserId, query);
        csv += 'Category Name,Quantity Sold,Revenue (KES),Percentage of Revenue (%)\n';
        for (const c of data.categories) {
          csv += `${this.escapeCsvCell(c.categoryName)},${this.escapeCsvCell(c.quantitySold)},${this.escapeCsvCell(c.revenue)},${this.escapeCsvCell(c.percentageOfRevenue)}%\n`;
        }
        break;
      }
      case 'WAITERS': {
        const data = await this.getAdminWaiters(adminUserId, query);
        csv += 'Waiter Name,Email,Orders Claimed,Orders Completed,Orders Cancelled,Active Orders,Completion Rate (%),Revenue Handled (KES),Avg Completion Time (Mins)\n';
        for (const w of data.waiters) {
          csv += `${this.escapeCsvCell(w.fullName)},${this.escapeCsvCell(w.email)},${this.escapeCsvCell(w.ordersClaimed)},${this.escapeCsvCell(w.ordersCompleted)},${this.escapeCsvCell(w.ordersCancelled)},${this.escapeCsvCell(w.activeOrders)},${this.escapeCsvCell(w.completionRate)}%,${this.escapeCsvCell(w.revenueHandled)},${this.escapeCsvCell(w.averageCompletionTimeMinutes)}\n`;
        }
        break;
      }
      default:
        throw new BadRequestError(`Unsupported report type: ${query.reportType}`);
    }

    // Audit log
    await this.reportingRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'REPORT_EXPORTED',
      entityType: 'REPORT',
      newValues: {
        reportType: query.reportType,
        range: query.range || 'LAST_7_DAYS',
        startDate: startStr,
        endDate: endStr,
      },
      ipAddress,
    });

    return { filename, csv };
  }

  // ─────────────────────────────────────────────────────────────
  // LEGACY COMPATIBILITY
  // ─────────────────────────────────────────────────────────────

  async generateAnalyticsReport(businessUuid: string, period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'WEEKLY') {
    let rangeEnum: ReportDateRangeType = 'LAST_7_DAYS';
    if (period === 'DAILY') rangeEnum = 'TODAY';
    else if (period === 'WEEKLY') rangeEnum = 'LAST_7_DAYS';
    else if (period === 'MONTHLY') rangeEnum = 'THIS_MONTH';
    else if (period === 'YEARLY') rangeEnum = 'LAST_30_DAYS';

    const range = this.resolveDateRange(rangeEnum);
    const [overview, paidPayments, orders, paymentsAgg, productsData, waitersData] = await Promise.all([
      this.reportingRepository.getRevenueForPeriod(businessUuid, range.start, range.end),
      this.reportingRepository.getPaidPaymentsInRange(businessUuid, range.start, range.end),
      this.reportingRepository.getOrdersForTrend(businessUuid, range.start, range.end),
      this.reportingRepository.getPaymentAggregations(businessUuid, range.start, range.end),
      this.reportingRepository.getOrderItemsForProducts(businessUuid, range.start, range.end),
      this.reportingRepository.getWaiterPerformanceData(businessUuid, range.start, range.end),
    ]);

    // 1. Daily Revenue & Orders
    const dailyMap: Record<string, number> = {};
    const dailyOrdersMap: Record<string, number> = {};
    for (const p of paidPayments) {
      const pDate = p.paidAt || (p as any).createdAt;
      if (!pDate) continue;
      const dateKey = new Date(pDate).toISOString().split('T')[0];
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + Number(p.amount || 0);
    }

    for (const o of orders) {
      const dateKey = new Date(o.createdAt).toISOString().split('T')[0];
      dailyOrdersMap[dateKey] = (dailyOrdersMap[dateKey] || 0) + 1;
      if (paidPayments.length === 0 && (o.status === 'COMPLETED' || o.status === 'DELIVERED')) {
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + Number(o.totalAmount || 0);
      }
    }

    const allDates = this.getDateList(range.start, range.end);
    const dailyRevenue = allDates.map((date) => ({
      date,
      day: date,
      revenue: Math.round((dailyMap[date] || 0) * 100) / 100,
      orders: dailyOrdersMap[date] || 0,
      orderCount: dailyOrdersMap[date] || 0,
    }));

    // 2. Hourly Orders
    const hourlyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = 0;
    for (const o of orders) {
      const hr = new Date(o.createdAt).getHours();
      hourlyMap[hr] = (hourlyMap[hr] || 0) + 1;
    }
    const hourlyOrders = Object.entries(hourlyMap).map(([h, count]) => ({
      hour: Number(h),
      h: Number(h),
      count,
      n: count,
    }));

    // 3. Payment Breakdown
    let totalPaymentTx = 0;
    const methodCounts: Record<string, number> = { MPESA_STK: 0, CARD: 0, CASH: 0 };
    for (const mb of paymentsAgg.methodBreakdown) {
      const c = mb._count.paymentUuid;
      methodCounts[mb.paymentMethod] = (methodCounts[mb.paymentMethod] || 0) + c;
      totalPaymentTx += c;
    }
    const paymentBreakdown = {
      mpesa: {
        count: methodCounts['MPESA_STK'] || 0,
        percentage: totalPaymentTx > 0 ? Math.round(((methodCounts['MPESA_STK'] || 0) / totalPaymentTx) * 100) : 0,
      },
      card: {
        count: methodCounts['CARD'] || 0,
        percentage: totalPaymentTx > 0 ? Math.round(((methodCounts['CARD'] || 0) / totalPaymentTx) * 100) : 0,
      },
      cash: {
        count: methodCounts['CASH'] || 0,
        percentage: totalPaymentTx > 0 ? Math.round(((methodCounts['CASH'] || 0) / totalPaymentTx) * 100) : 0,
      },
    };

    // 4. Top Products
    const prodMap: Record<string, { name: string; category: string; unitsSold: number; revenue: number }> = {};
    for (const item of productsData.orderItems) {
      const pId = item.productUuid;
      const name = item.product?.name || 'Product';
      const category = item.product?.category?.name || 'General';
      const qty = item.quantity || 1;
      const rev = Number(item.subtotal || Number(item.unitPrice || 0) * qty);
      if (!prodMap[pId]) prodMap[pId] = { name, category, unitsSold: 0, revenue: 0 };
      prodMap[pId].unitsSold += qty;
      prodMap[pId].revenue += rev;
    }
    const topProducts = Object.values(prodMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 5. Waiter Performance
    const waiterMap: Record<string, { name: string; ordersServed: number; revenueGenerated: number; totalMs: number }> = {};
    for (const w of waitersData.waiters) {
      waiterMap[w.userUuid] = { name: w.fullName, ordersServed: 0, revenueGenerated: 0, totalMs: 0 };
    }
    for (const o of waitersData.orders) {
      if (!o.waiterUuid) continue;
      if (!waiterMap[o.waiterUuid]) {
        waiterMap[o.waiterUuid] = { name: (o as any).waiter?.fullName || 'Staff', ordersServed: 0, revenueGenerated: 0, totalMs: 0 };
      }
      if (o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED) {
        waiterMap[o.waiterUuid].ordersServed += 1;
        waiterMap[o.waiterUuid].revenueGenerated += Number(o.totalAmount || 0);
        if (o.createdAt && o.updatedAt) {
          waiterMap[o.waiterUuid].totalMs += Math.max(0, o.updatedAt.getTime() - o.createdAt.getTime());
        }
      }
    }
    const waiterPerformance = Object.values(waiterMap).map((w) => ({
      name: w.name,
      ordersServed: w.ordersServed,
      revenueGenerated: Math.round(w.revenueGenerated * 100) / 100,
      avgFulfillmentMins: w.ordersServed > 0 ? Math.round(w.totalMs / (w.ordersServed * 60 * 1000) * 10) / 10 : 0,
    }));

    // 6. KPIs
    const completedOrders = orders.filter((o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED).length;
    const cancelledOrders = orders.filter((o) => o.status === OrderStatus.CANCELLED).length;

    return {
      period,
      generatedAt: new Date().toISOString(),
      kpis: {
        totalRevenue: overview,
        totalOrders: orders.length,
        totalOrdersCount: orders.length,
        completedOrders,
        cancelledOrders,
        averageOrderValue: completedOrders > 0 ? Math.round((overview / completedOrders) * 100) / 100 : 0,
        activeWaitersCount: waitersData.waiters.length,
      },
      dailyRevenue,
      hourlyOrders,
      paymentBreakdown,
      topProducts,
      waiterPerformance,
    };
  }

  generateCsvReport(data: any): string {
    let csv = 'Dimension,Metric,Value\n';
    csv += `KPIs,Total Revenue,KES ${data.kpis?.totalRevenue || 0}\n`;
    csv += `KPIs,Total Orders,${data.kpis?.totalOrdersCount || 0}\n`;
    csv += `KPIs,Average Order Value,KES ${data.kpis?.averageOrderValue || 0}\n`;
    return csv;
  }
}
