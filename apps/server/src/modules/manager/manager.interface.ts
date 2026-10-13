/**
 * Manager Management Module — Interfaces & Types
 *
 * All operations are strictly tenant-isolated to the authenticated ADMIN's business.
 * Role is strictly enforced as MANAGER server-side.
 */

import { UserRole } from '@orderup/shared';

export interface ManagerActivitySummary {
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  accountAgeDays: number;
}

export interface ManagerListItem {
  managerUuid: string;
  userUuid?: string; // alias for client compatibility
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
  activitySummary: ManagerActivitySummary;
}

export interface ManagerDetail extends ManagerListItem {
  business: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateManagerInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface UpdateManagerInput {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface UpdateManagerStatusInput {
  isActive: boolean;
}

export interface ResetManagerPasswordInput {
  temporaryPassword?: string;
}

export interface ResetManagerPasswordResult {
  managerUuid: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
  message: string;
}

export interface ManagerQueryFilters {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'fullName' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface ManagerSummaryKPIs {
  totalManagers: number;
  activeManagers: number;
  inactiveManagers: number;
}

export interface PaginatedManagers {
  managers: ManagerListItem[];
  summary: ManagerSummaryKPIs;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
