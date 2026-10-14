/**
 * Waiter Management Module — Interfaces & Types
 *
 * All operations are strictly tenant-isolated to the authenticated ADMIN's business.
 * Role is strictly enforced as WAITER server-side.
 *
 * ORDER METRICS NOTE:
 * The Order model contains a waiterUuid FK, enabling reliable waiter → order metrics.
 * ordersClaimed, ordersCompleted, and activeOrders are computed from live DB queries.
 */

import { UserRole } from '@orderup/shared';

export interface WaiterActivitySummary {
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  accountAgeDays: number;
  ordersClaimed: number;
  ordersCompleted: number;
  activeOrders: number;
}

export interface WaiterListItem {
  waiterUuid: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole | string;
  isActive: boolean;
  emailVerified: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  activitySummary: WaiterActivitySummary;
}

export interface WaiterDetail extends WaiterListItem {
  business: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateWaiterInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface UpdateWaiterInput {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface UpdateWaiterStatusInput {
  isActive: boolean;
}

export interface ResetWaiterPasswordInput {
  temporaryPassword?: string;
}

export interface ResetWaiterPasswordResult {
  waiterUuid: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
  message: string;
}

export interface WaiterQueryFilters {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'fullName' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface WaiterSummaryKPIs {
  totalWaiters: number;
  activeWaiters: number;
  inactiveWaiters: number;
  totalOrdersHandled: number;
}

export interface PaginatedWaiters {
  waiters: WaiterListItem[];
  summary: WaiterSummaryKPIs;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
