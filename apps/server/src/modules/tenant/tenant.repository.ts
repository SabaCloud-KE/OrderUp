import { Business, User, VenueTable, QrCode, UserRole, SubscriptionStatus, BusinessStatus, BusinessType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ITenantRepository, CreateBusinessWithAdminInput, BusinessWithAdmin, PlatformStats, BusinessSummary } from './tenant.interface';

export class TenantRepository implements ITenantRepository {
  async findBySlug(slug: string): Promise<Business | null> {
    return prisma.business.findFirst({
      where: { slug, deletedAt: null },
      include: {
        users: { where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER] } } },
        venueTables: { include: { qrCode: true } },
        _count: { select: { orders: true, venueTables: true, products: true, users: true } },
      },
    });
  }

  async findById(businessUuid: string): Promise<Business | null> {
    return prisma.business.findFirst({
      where: { businessUuid, deletedAt: null },
      include: {
        users: { where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER] } } },
        venueTables: { include: { qrCode: true } },
        _count: { select: { orders: true, venueTables: true, products: true, users: true } },
      },
    });
  }

  async findAll(): Promise<Business[]> {
    return prisma.business.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        users: { where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER] } } },
        _count: { select: { orders: true, venueTables: true, products: true, users: true } },
      },
    });
  }

  async getPlatformStats(): Promise<PlatformStats> {
    const [
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      totalUsers,
      totalAdmins,
      totalManagers,
      totalWaiters,
      totalOrders,
      revenueResult,
      completedOrdersRevenueResult,
      businessesByTypeRaw,
      recentBusinessesRaw,
    ] = await Promise.all([
      prisma.business.count({ where: { deletedAt: null } }),
      prisma.business.count({ where: { deletedAt: null, isActive: true, status: BusinessStatus.ACTIVE } }),
      prisma.business.count({ where: { deletedAt: null, status: BusinessStatus.SUSPENDED } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, role: UserRole.ADMIN } }),
      prisma.user.count({ where: { deletedAt: null, role: UserRole.MANAGER } }),
      prisma.user.count({ where: { deletedAt: null, role: UserRole.WAITER } }),
      prisma.order.count(),
      prisma.payment.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { amount: true },
      }),
      prisma.order.aggregate({
        where: { status: { in: ['COMPLETED', 'DELIVERED'] } },
        _sum: { totalAmount: true },
      }),
      prisma.business.groupBy({
        by: ['businessType'],
        where: { deletedAt: null },
        _count: { businessUuid: true },
      }),
      prisma.business.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          users: {
            where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER] }, deletedAt: null },
            take: 1,
          },
        },
      }),
    ]);

    const businessesByType: Record<string, number> = {};
    businessesByTypeRaw.forEach((b) => {
      businessesByType[b.businessType] = b._count.businessUuid;
    });

    const recentBusinesses = recentBusinessesRaw.map((b) => {
      const primaryAdmin = b.users?.[0];
      return {
        businessUuid: b.businessUuid,
        name: b.name,
        slug: b.slug,
        businessType: b.businessType,
        status: b.status,
        city: b.city,
        county: b.county,
        createdAt: b.createdAt,
        admin: primaryAdmin
          ? {
              fullName: primaryAdmin.fullName,
              email: primaryAdmin.email,
              phone: primaryAdmin.phone,
            }
          : null,
      };
    });

    return {
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      totalUsers,
      totalAdmins,
      totalManagers,
      totalWaiters,
      totalOrders,
      totalRevenue: Number(revenueResult._sum?.amount || completedOrdersRevenueResult._sum?.totalAmount || 0),
      businessesByType,
      recentBusinesses,
    };
  }

  async getBusinessSummary(businessUuid: string): Promise<BusinessSummary | null> {
    const business = await prisma.business.findFirst({
      where: { businessUuid, deletedAt: null },
      include: {
        users: {
          where: { deletedAt: null },
          select: {
            userUuid: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        venueTables: {
          include: { qrCode: true },
        },
        _count: {
          select: {
            orders: true,
            venueTables: true,
            products: true,
            users: true,
          },
        },
      },
    });

    if (!business) return null;

    const [
      managersCount,
      waitersCount,
      tablesCount,
      totalOrders,
      completedOrders,
      pendingOrders,
      revenueResult,
      orderRevenueResult,
    ] = await Promise.all([
      prisma.user.count({ where: { businessUuid, role: UserRole.MANAGER, isActive: true, deletedAt: null } }),
      prisma.user.count({ where: { businessUuid, role: UserRole.WAITER, isActive: true, deletedAt: null } }),
      prisma.venueTable.count({ where: { businessUuid } }),
      prisma.order.count({ where: { businessUuid } }),
      prisma.order.count({ where: { businessUuid, status: { in: ['COMPLETED', 'DELIVERED'] } } }),
      prisma.order.count({ where: { businessUuid, status: 'PENDING' } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { businessUuid, paymentStatus: 'PAID' },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { businessUuid, status: { in: ['COMPLETED', 'DELIVERED'] } },
      }),
    ]);

    return {
      business,
      managersCount,
      waitersCount,
      tablesCount,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalRevenue: Number(revenueResult._sum?.amount || orderRevenueResult._sum?.totalAmount || 0),
    };
  }

  async create(data: Partial<Business>): Promise<Business> {
    return prisma.business.create({
      data: {
        name: data.name!,
        slug: data.slug!,
        businessType: data.businessType || BusinessType.RESTAURANT,
        city: data.city || 'Nairobi',
        county: data.county || 'Nairobi',
        logoUrl: data.logoUrl,
        bannerUrl: (data as any).bannerUrl,
        description: (data as any).description,
        phone: data.phone,
        email: data.email,
        address: data.address,
        gpsCoordinates: data.gpsCoordinates,
        themeColor: data.themeColor || '#e11d48',
        openingHours: data.openingHours || '08:00',
        closingHours: data.closingHours || '23:00',
        status: BusinessStatus.ACTIVE,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        isActive: true,
      },
    });
  }

  async createBusinessWithAdmin(data: CreateBusinessWithAdminInput): Promise<BusinessWithAdmin> {
    const doCreate = async (slugToUse: string) => {
      return prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: data.name,
            slug: slugToUse,
            businessType: data.businessType || BusinessType.RESTAURANT,
            city: data.city || 'Nairobi',
            county: data.county || 'Nairobi',
            address: data.address,
            phone: data.phone,
            email: data.email,
            logoUrl: data.logoUrl,
            bannerUrl: data.bannerUrl,
            description: data.description,
            themeColor: data.themeColor || '#e11d48',
            openingHours: data.openingHours || '08:00',
            closingHours: data.closingHours || '23:00',
            gpsCoordinates: data.gpsCoordinates,
            status: BusinessStatus.ACTIVE,
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            isActive: true,
          },
        });

        const admin = await tx.user.create({
          data: {
            businessUuid: business.businessUuid,
            email: data.adminEmail,
            passwordHash: data.adminPasswordHash,
            fullName: data.adminFullName,
            phone: data.adminPhone,
            role: UserRole.ADMIN,
            isActive: true,
            mustChangePassword: true,
          },
        });

        return { business, admin };
      });
    };

    try {
      return await doCreate(data.slug);
    } catch (err: any) {
      if (err.code === 'P2002' && (err.meta?.target?.includes('slug') || err.message?.includes('slug'))) {
        const uniqueSlug = `${data.slug}-${Date.now().toString(36)}`;
        return await doCreate(uniqueSlug);
      }
      throw err;
    }
  }

  // Alias for backward compatibility
  async createClubWithManager(data: any): Promise<any> {
    const res = await this.createBusinessWithAdmin({
      name: data.name,
      slug: data.slug,
      businessType: data.businessType,
      city: data.city,
      county: data.county,
      address: data.address,
      phone: data.phone,
      email: data.email,
      logoUrl: data.logoUrl,
      themeColor: data.themeColor || data.brandColor,
      openingHours: data.openingHours,
      closingHours: data.closingHours,
      gpsCoordinates: data.gpsCoordinates,
      adminEmail: data.managerEmail || data.adminEmail,
      adminFullName: data.managerFullName || data.adminFullName,
      adminPasswordHash: data.managerPasswordHash || data.adminPasswordHash,
      adminPhone: data.managerPhone || data.adminPhone,
    });
    return { club: res.business, manager: res.admin, business: res.business, admin: res.admin };
  }

  async update(businessUuid: string, data: Partial<Business>): Promise<Business> {
    return prisma.business.update({
      where: { businessUuid },
      data: data as any,
    });
  }

  async delete(businessUuid: string): Promise<boolean> {
    await prisma.business.update({
      where: { businessUuid },
      data: {
        deletedAt: new Date(),
        isActive: false,
        status: BusinessStatus.SUSPENDED,
        subscriptionStatus: SubscriptionStatus.CANCELLED,
      },
    });
    return true;
  }

  async assignManager(businessUuid: string, userUuid: string): Promise<User> {
    return prisma.user.update({
      where: { userUuid },
      data: {
        businessUuid,
        role: UserRole.MANAGER,
      },
    });
  }

  async getTables(businessUuid: string): Promise<VenueTable[]> {
    return prisma.venueTable.findMany({
      where: { businessUuid, deletedAt: null },
      include: { qrCode: true },
      orderBy: { tableNumber: 'asc' },
    });
  }

  async generateTablesAndQrs(
    businessUuid: string,
    tableCount: number,
    sectionName: string,
    startFrom?: number,
  ): Promise<{ tables: VenueTable[]; qrs: QrCode[] }> {
    const business = await this.findById(businessUuid);
    if (!business) throw new Error('Business not found');

    const createdTables: VenueTable[] = [];
    const createdQrs: QrCode[] = [];
    const effectiveSection = sectionName?.trim() || 'Main Dining Area';

    let firstNum = startFrom;
    if (!firstNum) {
      const maxTable = await prisma.venueTable.findFirst({
        where: { businessUuid, deletedAt: null },
        orderBy: { tableNumber: 'desc' },
      });
      firstNum = maxTable ? maxTable.tableNumber + 1 : 1;
    }

    for (let i = 0; i < tableCount; i++) {
      const tableNum = firstNum + i;
      const table = await prisma.venueTable.upsert({
        where: {
          businessUuid_tableNumber: {
            businessUuid,
            tableNumber: tableNum,
          },
        },
        update: {
          sectionName: effectiveSection,
          deletedAt: null,
          isActive: true,
        },
        create: {
          businessUuid,
          tableNumber: tableNum,
          sectionName: effectiveSection,
          seatingCapacity: 4,
        },
      });

      let rawPwa = env.CUSTOMER_PWA_URL || process.env.CUSTOMER_PWA_URL || process.env.CLIENT_URL || 'https://orderup-customer.vercel.app';
      if (rawPwa.includes('drink-hub') || rawPwa.includes('orderup-ke-customer-pwa')) {
        rawPwa = 'https://orderup-customer.vercel.app';
      }
      const cleanPwaBase = rawPwa.endsWith('/') ? rawPwa.slice(0, -1) : rawPwa;
      const qrPayload = `${cleanPwaBase}/v/${business.slug}/t/${tableNum}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;

      const qr = await prisma.qrCode.upsert({
        where: { tableUuid: table.tableUuid },
        update: {
          qrCodePayload: qrPayload,
          imageUrl: qrImageUrl,
          isActive: true,
        },
        create: {
          businessUuid,
          tableUuid: table.tableUuid,
          qrCodePayload: qrPayload,
          imageUrl: qrImageUrl,
        },
      });

      createdTables.push(table);
      createdQrs.push(qr);
    }

    return { tables: createdTables, qrs: createdQrs };
  }

  async deleteTable(businessUuid: string, tableNumber: number): Promise<boolean> {
    const table = await prisma.venueTable.findFirst({
      where: { businessUuid, tableNumber, deletedAt: null },
    });

    if (table) {
      await prisma.$transaction([
        prisma.venueTable.update({
          where: { tableUuid: table.tableUuid },
          data: { deletedAt: new Date(), isActive: false },
        }),
        prisma.qrCode.updateMany({
          where: { tableUuid: table.tableUuid },
          data: { isActive: false },
        }),
      ]);
    }

    return true;
  }
}

