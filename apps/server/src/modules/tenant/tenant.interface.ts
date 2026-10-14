import { Business, User, VenueTable, QrCode, BusinessType } from '@prisma/client';

export interface CreateBusinessWithAdminInput {
  // Business fields
  name: string;
  slug: string;
  businessType?: BusinessType;
  city?: string;
  county?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  themeColor?: string;
  openingHours?: string;
  closingHours?: string;
  gpsCoordinates?: string;
  // Admin fields (already hashed)
  adminPasswordHash: string;
  adminFullName: string;
  adminEmail: string;
  adminPhone?: string;
}

export interface BusinessWithAdmin {
  business: Business;
  admin: User;
}

// Backward compatibility aliases
export type CreateClubWithManagerInput = CreateBusinessWithAdminInput;
export type ClubWithManager = BusinessWithAdmin;

export interface PlatformStats {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  totalUsers: number;
  totalAdmins: number;
  totalManagers: number;
  totalWaiters: number;
  totalOrders: number;
  totalRevenue: number;
  businessesByType: Record<string, number>;
  recentBusinesses: Array<{
    businessUuid: string;
    name: string;
    slug: string;
    businessType: BusinessType;
    status: string;
    city: string;
    county: string;
    createdAt: Date;
    admin?: {
      fullName: string;
      email: string;
      phone?: string | null;
    } | null;
  }>;
}

export interface BusinessSummary {
  business: Business;
  managersCount: number;
  waitersCount: number;
  tablesCount: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalRevenue: number;
}

export interface ITenantRepository {
  findBySlug(slug: string): Promise<Business | null>;
  findById(businessUuid: string): Promise<Business | null>;
  findAll(): Promise<Business[]>;
  getPlatformStats(): Promise<PlatformStats>;
  getBusinessSummary(businessUuid: string): Promise<BusinessSummary | null>;
  create(data: Partial<Business>): Promise<Business>;
  createBusinessWithAdmin(data: CreateBusinessWithAdminInput): Promise<BusinessWithAdmin>;
  update(businessUuid: string, data: Partial<Business>): Promise<Business>;
  delete(businessUuid: string): Promise<boolean>;
  assignManager(businessUuid: string, userUuid: string): Promise<User>;
  getTables(businessUuid: string): Promise<VenueTable[]>;
  generateTablesAndQrs(businessUuid: string, tableCount: number, sectionName: string, startFrom?: number): Promise<{ tables: VenueTable[]; qrs: QrCode[] }>;
  deleteTable(businessUuid: string, tableNumber: number): Promise<boolean>;
}

