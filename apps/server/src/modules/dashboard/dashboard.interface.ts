/**
 * Dashboard Module — Interfaces & Types
 *
 * Defines the typed response structure for GET /api/v1/dashboard/admin/overview.
 * All data is scoped to the authenticated ADMIN's business only.
 */

// ─── Business Info ────────────────────────────────────────────────────────────

export interface DashboardBusiness {
  id: string;
  name: string;
  type: string;
  slug: string;
  city: string;
  county: string;
  status: string;
}

// ─── Summary KPI Cards ────────────────────────────────────────────────────────

export interface DashboardSummary {
  /** Revenue from PAID payments today only */
  todayRevenue: number;
  /** Total orders created today */
  todayOrders: number;
  /** Orders with status = PENDING */
  pendingOrders: number;
  /**
   * Orders with status in [CLAIMED, PREPARING, READY].
   * These are actively being worked on.
   */
  inProgressOrders: number;
  /**
   * Orders with status in [DELIVERED, COMPLETED].
   * These are successfully fulfilled.
   */
  completedOrders: number;
  /** Orders with status = CANCELLED */
  cancelledOrders: number;
  /** Active MANAGER users in this business */
  totalManagers: number;
  /** Active WAITER users in this business */
  totalWaiters: number;
}

// ─── Trend Comparison (Today vs Yesterday) ───────────────────────────────────

export interface DashboardTrendComparison {
  today: number;
  previousDay: number;
  /**
   * Percentage change from previous day to today.
   * Formula: ((today - previousDay) / previousDay) * 100
   * Returns null when previousDay = 0 to avoid Infinity/NaN.
   */
  percentageChange: number | null;
}

// ─── Recent Orders ────────────────────────────────────────────────────────────

export interface DashboardRecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentStatus: string | null;
  paymentMethod: string | null;
  tableNumber: number | null;
  sectionName: string | null;
  createdAt: string;
}

// ─── Top Menu Items ───────────────────────────────────────────────────────────

export interface DashboardTopMenuItem {
  itemId: string;
  name: string;
  category: string;
  quantitySold: number;
  revenueGenerated: number;
}

// ─── Sales Trend (7-Day) ──────────────────────────────────────────────────────

export interface DashboardSalesTrendDay {
  date: string;        // ISO date string YYYY-MM-DD
  dayLabel: string;    // e.g. "Mon", "Tue"
  revenue: number;
  orders: number;
}

// ─── Full Overview Response ───────────────────────────────────────────────────

export interface AdminDashboardOverview {
  business: DashboardBusiness;
  summary: DashboardSummary;
  revenue: DashboardTrendComparison;
  orders: DashboardTrendComparison;
  recentOrders: DashboardRecentOrder[];
  topMenuItems: DashboardTopMenuItem[];
  salesTrend: DashboardSalesTrendDay[];
  tableUtilization?: DashboardTableUtilization;
  pendingOrderAge?: DashboardPendingOrderAge;
}

// ─── Internal Repository Types ────────────────────────────────────────────────

export interface DashboardDateRange {
  start: Date;
  end: Date;
}

export interface DashboardStatusCounts {
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  total: number;
}

// ─── Table Utilization KPI ────────────────────────────────────────────────────

export interface DashboardTableUtilization {
  /** Total active (isActive=true) VenueTable records for the business */
  activeTables: number;
  /** Distinct tables that had at least 1 order created today */
  tablesUsedToday: number;
  /** (tablesUsedToday / activeTables) * 100, or 0 if activeTables = 0 */
  utilizationRate: number;
}

// ─── Pending Order Age KPI ────────────────────────────────────────────────────

export interface DashboardPendingOrderAge {
  /** Total orders currently in PENDING status */
  totalPending: number;
  /** Age in minutes of the oldest currently-pending order; 0 if none */
  oldestAgeMinutes: number;
  /** Count of pending orders that have been waiting more than 5 minutes */
  ordersOver5Min: number;
  /** Count of pending orders that have been waiting more than 10 minutes */
  ordersOver10Min: number;
}
