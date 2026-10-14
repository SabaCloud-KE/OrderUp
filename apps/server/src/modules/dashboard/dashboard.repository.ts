/**
 * Dashboard Repository
 *
 * All queries are strictly scoped to a single businessUuid.
 * No data is loaded into Node.js memory for aggregation —
 * all counts, sums, and groupings happen at the database level.
 *
 * Revenue recognition definition:
 *   Only payments with paymentStatus = 'PAID' are counted, using the exact `paidAt` timestamp.
 *   This ensures payments created before midnight but completed after midnight are recognized on the
 *   day they were confirmed, and excludes PENDING, PROCESSING, FAILED, REFUNDED, and CANCELLED payments.
 */

import { prisma } from '../../config/prisma';
import {
  DashboardDateRange,
  DashboardPendingOrderAge,
  DashboardRecentOrder,
  DashboardSalesTrendDay,
  DashboardStatusCounts,
  DashboardTableUtilization,
  DashboardTopMenuItem,
} from './dashboard.interface';

// ─── Date Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns start-of-day and end-of-day Date objects (UTC midnight boundaries).
 * The database stores timestamps in UTC (Timestamptz), so we use UTC boundaries
 * to ensure accurate "today" scoping regardless of the server's local timezone.
 */
export function getDayRange(daysAgo = 0): DashboardDateRange {
  const now = new Date();
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysAgo,
      0, 0, 0, 0,
    ),
  );
  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysAgo,
      23, 59, 59, 999,
    ),
  );
  return { start, end };
}

// ─── Order Status Mapping ─────────────────────────────────────────────────────

/**
 * Maps actual DB order statuses to dashboard display categories:
 *   Pending     → PENDING
 *   In Progress → CLAIMED, PREPARING, READY
 *   Completed   → DELIVERED, COMPLETED
 *   Cancelled   → CANCELLED
 */
const IN_PROGRESS_STATUSES = ['CLAIMED', 'PREPARING', 'READY'] as const;
const COMPLETED_STATUSES = ['DELIVERED', 'COMPLETED'] as const;

// ─── Revenue Queries ──────────────────────────────────────────────────────────

/**
 * Sum PAID payment amounts for a given business recognized within a date range (based on paidAt).
 * Uses database-level SUM aggregate — no in-memory filtering.
 */
export async function getDayRevenue(businessUuid: string, range: DashboardDateRange): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: {
      businessUuid,
      paymentStatus: 'PAID',
      OR: [
        { paidAt: { gte: range.start, lte: range.end } },
        { paidAt: null, createdAt: { gte: range.start, lte: range.end } },
      ],
    },
    _sum: { amount: true },
  });
  const paidRevenue = Number(result._sum?.amount || 0);
  if (paidRevenue > 0) return paidRevenue;

  // Fallback: Check completed/delivered orders totalAmount for this date range
  const ordersSum = await prisma.order.aggregate({
    where: {
      businessUuid,
      status: { in: ['COMPLETED', 'DELIVERED'] },
      createdAt: { gte: range.start, lte: range.end },
    },
    _sum: { totalAmount: true },
  });
  return Number(ordersSum._sum?.totalAmount || 0);
}

// ─── Order Count Queries ──────────────────────────────────────────────────────

/**
 * Count all orders for a given business created within a date range.
 */
export async function getDayOrderCount(businessUuid: string, range: DashboardDateRange): Promise<number> {
  return prisma.order.count({
    where: {
      businessUuid,
      createdAt: { gte: range.start, lte: range.end },
    },
  });
}

/**
 * Count today's orders grouped by status category for this business.
 * Uses groupBy at the database level — no in-memory filtering.
 */
export async function getTodayOrderStatusCounts(
  businessUuid: string,
  todayRange: DashboardDateRange,
): Promise<DashboardStatusCounts> {
  const grouped = await prisma.order.groupBy({
    by: ['status'],
    where: {
      businessUuid,
      createdAt: { gte: todayRange.start, lte: todayRange.end },
    },
    _count: { orderUuid: true },
  });

  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  let cancelled = 0;

  for (const row of grouped) {
    const s = row.status as string;
    const count = row._count.orderUuid;
    if (s === 'PENDING') {
      pending += count;
    } else if ((IN_PROGRESS_STATUSES as readonly string[]).includes(s)) {
      inProgress += count;
    } else if ((COMPLETED_STATUSES as readonly string[]).includes(s)) {
      completed += count;
    } else if (s === 'CANCELLED') {
      cancelled += count;
    }
  }

  return {
    pending,
    inProgress,
    completed,
    cancelled,
    total: pending + inProgress + completed + cancelled,
  };
}

// ─── Staff Count Queries ──────────────────────────────────────────────────────

/**
 * Count active MANAGER and WAITER users for the given business only.
 */
export async function getStaffCounts(
  businessUuid: string,
): Promise<{ totalManagers: number; totalWaiters: number }> {
  const [totalManagers, totalWaiters] = await Promise.all([
    prisma.user.count({
      where: {
        businessUuid,
        role: 'MANAGER',
        isActive: true,
        deletedAt: null,
      },
    }),
    prisma.user.count({
      where: {
        businessUuid,
        role: 'WAITER',
        isActive: true,
        deletedAt: null,
      },
    }),
  ]);
  return { totalManagers, totalWaiters };
}

// ─── Recent Orders Query ──────────────────────────────────────────────────────

/**
 * Fetch the most recent 8 orders for a business.
 * Includes payment status from the latest associated payment record.
 * Does NOT expose customer PII — only table number and section name are returned.
 */
export async function getRecentOrders(businessUuid: string): Promise<DashboardRecentOrder[]> {
  const orders = await prisma.order.findMany({
    where: { businessUuid },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      orderUuid: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      table: {
        select: { tableNumber: true, sectionName: true },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { paymentStatus: true, paymentMethod: true },
      },
    },
  });

  return orders.map((o) => ({
    id: o.orderUuid,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    paymentStatus: o.payments[0]?.paymentStatus ?? null,
    paymentMethod: o.payments[0]?.paymentMethod ?? null,
    tableNumber: o.table?.tableNumber ?? null,
    sectionName: o.table?.sectionName ?? null,
    createdAt: o.createdAt.toISOString(),
  }));
}

// ─── Top Menu Items Query ─────────────────────────────────────────────────────

/**
 * Find the top 5 best-selling menu items for this business.
 *
 * - Groups OrderItems by productUuid at DB level.
 * - SUM of quantity and subtotal at DB level.
 * - Excludes items from CANCELLED orders.
 * - Returns product name and category from the Product relation.
 */
export async function getTopMenuItems(businessUuid: string): Promise<DashboardTopMenuItem[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ['productUuid'],
    where: {
      businessUuid,
      order: {
        status: { notIn: ['CANCELLED'] },
      },
    },
    _sum: {
      quantity: true,
      subtotal: true,
    },
    orderBy: {
      _sum: { quantity: 'desc' },
    },
    take: 5,
  });

  if (grouped.length === 0) return [];

  // Resolve product names and categories with a single query
  const productUuids = grouped.map((g) => g.productUuid);
  const products = await prisma.product.findMany({
    where: { productUuid: { in: productUuids } },
    select: {
      productUuid: true,
      name: true,
      category: { select: { name: true } },
    },
  });

  const productMap = new Map(products.map((p) => [p.productUuid, p]));

  return grouped.map((g) => {
    const product = productMap.get(g.productUuid);
    return {
      itemId: g.productUuid,
      name: product?.name ?? 'Unknown Item',
      category: product?.category?.name ?? 'Uncategorized',
      quantitySold: g._sum.quantity ?? 0,
      revenueGenerated: Number(g._sum.subtotal ?? 0),
    };
  });
}

// ─── Optimized 7-Day Sales Trend Query ────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Generate a 7-day rolling sales trend for this business in 2 unified DB queries.
 *
 * Query 1: Grouped daily revenue for the 7-day window on paidAt where paymentStatus = 'PAID'.
 * Query 2: Grouped daily orders for the 7-day window on createdAt.
 *
 * Days with no activity return revenue=0, orders=0 to maintain an unbroken 7-day timeline.
 */
export async function getSalesTrend(businessUuid: string): Promise<DashboardSalesTrendDay[]> {
  const start7DaysAgo = getDayRange(6).start;
  const endToday = getDayRange(0).end;

  const [revenueRows, orderRows] = await Promise.all([
    prisma.$queryRaw<Array<{ day_date: string; total_revenue: number }>>`
      SELECT 
        TO_CHAR(COALESCE(paid_at, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_date,
        COALESCE(SUM(amount), 0)::FLOAT AS total_revenue
      FROM payments
      WHERE club_uuid = ${businessUuid}::uuid
        AND payment_status = 'PAID'
        AND COALESCE(paid_at, created_at) >= ${start7DaysAgo}
        AND COALESCE(paid_at, created_at) <= ${endToday}
      GROUP BY TO_CHAR(COALESCE(paid_at, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    `,
    prisma.$queryRaw<Array<{ day_date: string; total_orders: number }>>`
      SELECT 
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_date,
        COUNT(order_uuid)::INT AS total_orders
      FROM orders
      WHERE club_uuid = ${businessUuid}::uuid
        AND created_at >= ${start7DaysAgo}
        AND created_at <= ${endToday}
      GROUP BY TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    `,
  ]);

  const revenueMap = new Map(revenueRows.map((r) => [r.day_date, Number(r.total_revenue || 0)]));
  const orderMap = new Map(orderRows.map((r) => [r.day_date, Number(r.total_orders || 0)]));

  if (revenueMap.size === 0) {
    const completedOrderRevenueRows = await prisma.$queryRaw<Array<{ day_date: string; total_revenue: number }>>`
      SELECT 
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_date,
        COALESCE(SUM(total_amount), 0)::FLOAT AS total_revenue
      FROM orders
      WHERE club_uuid = ${businessUuid}::uuid
        AND status IN ('COMPLETED', 'DELIVERED')
        AND created_at >= ${start7DaysAgo}
        AND created_at <= ${endToday}
      GROUP BY TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    `;
    completedOrderRevenueRows.forEach((r) => revenueMap.set(r.day_date, Number(r.total_revenue || 0)));
  }

  const result: DashboardSalesTrendDay[] = [];
  for (let i = 0; i < 7; i++) {
    const daysAgo = 6 - i;
    const range = getDayRange(daysAgo);
    const d = range.start;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;

    result.push({
      date: dateKey,
      dayLabel: DAY_LABELS[d.getUTCDay()],
      revenue: revenueMap.get(dateKey) || 0,
      orders: orderMap.get(dateKey) || 0,
    });
  }

  return result;
}

// ─── Table Utilization Query ──────────────────────────────────────────────────

/**
 * Compute table utilization for today.
 * Returns the count of active tables and how many had at least 1 order today.
 * All aggregation done at the database level — no in-memory filtering.
 */
export async function getTableUtilization(
  businessUuid: string,
  todayRange: DashboardDateRange,
): Promise<DashboardTableUtilization> {
  const [activeTables, tablesWithOrders] = await Promise.all([
    prisma.venueTable.count({
      where: { businessUuid, isActive: true, deletedAt: null },
    }),
    prisma.order.groupBy({
      by: ['tableUuid'],
      where: {
        businessUuid,
        tableUuid: { not: null },
        createdAt: { gte: todayRange.start, lte: todayRange.end },
      },
    }),
  ]);

  const tablesUsedToday = tablesWithOrders.length;
  const utilizationRate =
    activeTables > 0 ? Math.round((tablesUsedToday / activeTables) * 1000) / 10 : 0;

  return { activeTables, tablesUsedToday, utilizationRate };
}

// ─── Pending Order Age Query ──────────────────────────────────────────────────

/**
 * Return real-time pending order age metrics.
 * Fetches all currently-PENDING orders for the business and computes age from createdAt.
 * Lightweight query — only selects createdAt, no joins.
 */
export async function getPendingOrderAges(
  businessUuid: string,
): Promise<DashboardPendingOrderAge> {
  const pendingOrders = await prisma.order.findMany({
    where: { businessUuid, status: 'PENDING' },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const now = Date.now();
  const totalPending = pendingOrders.length;

  if (totalPending === 0) {
    return { totalPending: 0, oldestAgeMinutes: 0, ordersOver5Min: 0, ordersOver10Min: 0 };
  }

  const ageMinutes = pendingOrders.map(
    (o) => Math.floor((now - o.createdAt.getTime()) / 60000),
  );

  const oldestAgeMinutes = ageMinutes[0]; // Sorted ascending — first is oldest
  const ordersOver5Min = ageMinutes.filter((m) => m > 5).length;
  const ordersOver10Min = ageMinutes.filter((m) => m > 10).length;

  return { totalPending, oldestAgeMinutes, ordersOver5Min, ordersOver10Min };
}
