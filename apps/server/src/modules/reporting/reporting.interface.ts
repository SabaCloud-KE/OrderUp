/**
 * Reporting & Analytics Module — Interfaces and DTOs
 *
 * Strongly-typed DTOs for Admin business analytics.
 * Strictly scoped to the authenticated Admin's business with database-level metrics.
 */

export type ReportDateRangeType =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'CUSTOM';

export interface ResolvedDateRange {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  daysCount: number;
}

export interface AdminReportQueryParams {
  range?: ReportDateRangeType;
  startDate?: string;
  endDate?: string;
}

export interface ReportOverviewDTO {
  revenue: {
    totalRevenue: number;
    previousPeriodRevenue: number;
    percentageChange: number | null;
  };
  orders: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    ordersInProgress: number;
    previousPeriodOrders: number;
    percentageChange: number | null;
  };
  averageOrderValue: number;
  dateRange: {
    range: ReportDateRangeType;
    startDate: string;
    endDate: string;
  };
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
}

export interface RevenueReportDTO {
  totalRevenue: number;
  previousPeriodRevenue: number;
  percentageChange: number | null;
  averageDailyRevenue: number;
  highestRevenueDay: { date: string; revenue: number } | null;
  lowestRevenueDay: { date: string; revenue: number } | null;
  revenueTrend: RevenueTrendPoint[];
  dateRange: {
    range: ReportDateRangeType;
    startDate: string;
    endDate: string;
  };
}

export interface OrderTrendPoint {
  date: string;
  count: number;
  completedCount: number;
  cancelledCount: number;
  revenue: number;
}

export interface OrderStatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface OrderReportDTO {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  ordersInProgress: number;
  averageOrdersPerDay: number;
  orderTrend: OrderTrendPoint[];
  statusDistribution: OrderStatusDistributionItem[];
  categoryDistribution: {
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  dateRange: {
    range: ReportDateRangeType;
    startDate: string;
    endDate: string;
  };
}

export interface PaymentMethodBreakdownItem {
  method: string;
  transactions: number;
  revenue: number;
  percentage: number;
}

export interface PaymentStatusBreakdownItem {
  status: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface PaymentReportDTO {
  totalSettledRevenue: number;
  successfulPayments: number;
  pendingPayments: number;
  processingPayments: number;
  failedPayments: number;
  cancelledPayments: number;
  refundedPayments: number;
  paymentMethodBreakdown: PaymentMethodBreakdownItem[];
  paymentStatusBreakdown: PaymentStatusBreakdownItem[];
  dateRange: {
    range: ReportDateRangeType;
    startDate: string;
    endDate: string;
  };
}

export interface ProductPerformanceItem {
  productUuid: string;
  productName: string;
  category: string;
  quantitySold: number;
  revenue: number;
  percentageOfTotalRevenue: number;
}

export interface ProductPerformanceReportDTO {
  topProducts: ProductPerformanceItem[];
  bottomProducts: ProductPerformanceItem[];
  totalProductsSold: number;
  totalProductRevenue: number;
  dateRange: {
    range: ReportDateRangeType;
    startDate: string;
    endDate: string;
  };
}

export interface CategoryPerformanceItem {
  categoryUuid: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
  percentageOfRevenue: number;
}

export interface CategoryPerformanceReportDTO {
  categories: CategoryPerformanceItem[];
  totalRevenue: number;
  totalQuantitySold: number;
  dateRange: {
    range: ReportDateRangeType;
    startDate: string;
    endDate: string;
  };
}

export interface WaiterPerformanceItem {
  waiterUuid: string;
  fullName: string;
  email: string;
  ordersClaimed: number;
  ordersCompleted: number;
  ordersCancelled: number;
  activeOrders: number;
  completionRate: number;
  revenueHandled: number;
  averageCompletionTimeMinutes: number;
}

export interface WaiterPerformanceReportDTO {
  waiters: WaiterPerformanceItem[];
  totalOrdersClaimed: number;
  totalOrdersCompleted: number;
  overallCompletionRate: number;
  dateRange: {
    range: ReportDateRangeType;
    startDate: string;
    endDate: string;
  };
}

export type ReportExportType =
  | 'REVENUE'
  | 'ORDERS'
  | 'PAYMENTS'
  | 'PRODUCTS'
  | 'CATEGORIES'
  | 'WAITERS';

export interface AdminExportQueryParams extends AdminReportQueryParams {
  reportType: ReportExportType;
}

// ─── Discount Impact ───────────────────────────────────────────────────────────

export interface DiscountImpactDTO {
  /** Number of orders that had an offer (offerUuid IS NOT NULL) */
  ordersWithOffers: number;
  /** Sum of discountAmount across all orders in the period */
  totalDiscountGiven: number;
  /** totalDiscountGiven / ordersWithOffers, or 0 if no offer orders */
  averageDiscountPerOrder: number;
  /** totalDiscountGiven / (totalRevenue + totalDiscountGiven) * 100, or 0 */
  discountPercentageOfGrossRevenue: number;
}

export interface ManagerReportQueryParams {
  range?: ReportDateRangeType;
  startDate?: string;
  endDate?: string;
}
