import bcrypt from 'bcrypt';
import { Business, SubscriptionStatus, BusinessStatus, BusinessType } from '@prisma/client';
import { ITenantRepository } from './tenant.interface';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error';
import { prisma } from '../../config/prisma';
import { emailService } from '../notification/email.service';
import { logger } from '../../config/logger';
import { encryptCredential, maskCredential } from '../../utils/crypto';

const BCRYPT_ROUNDS = 12;

export class TenantService {
  constructor(private tenantRepository: ITenantRepository) {}

  public maskBusinessSecrets<T extends Partial<Business>>(b: T): T {
    if (!b) return b;
    const clone = { ...b } as any;
    if (clone.mpesaConsumerSecret) {
      clone.mpesaConsumerSecret = maskCredential(clone.mpesaConsumerSecret);
    }
    if (clone.mpesaPasskey) {
      clone.mpesaPasskey = maskCredential(clone.mpesaPasskey);
    }
    clone.hasMpesaConfig = Boolean(
      clone.isMpesaActive &&
      clone.mpesaConsumerKey &&
      clone.mpesaConsumerSecret &&
      clone.mpesaShortcode &&
      clone.mpesaPasskey
    );
    return clone;
  }

  async getTenantBySlug(slug: string): Promise<Business> {
    let tenant = await this.tenantRepository.findBySlug(slug);
    if (!tenant) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      if (isUuid) {
        tenant = await this.tenantRepository.findById(slug);
      }
    }
    if (!tenant) {
      throw new NotFoundError(`Business with slug '${slug}' not found`);
    }
    return this.maskBusinessSecrets(tenant);
  }

  async getTenantById(businessUuid: string): Promise<Business> {
    const tenant = await this.tenantRepository.findById(businessUuid);
    if (!tenant) {
      throw new NotFoundError(`Business not found`);
    }
    return this.maskBusinessSecrets(tenant);
  }

  async getAllTenants(): Promise<Business[]> {
    const list = await this.tenantRepository.findAll();
    return list.map(b => this.maskBusinessSecrets(b));
  }

  async getPlatformStats() {
    return this.tenantRepository.getPlatformStats();
  }

  async getBusinessSummary(businessUuid: string) {
    const summary = await this.tenantRepository.getBusinessSummary(businessUuid);
    if (!summary) {
      throw new NotFoundError('Business not found');
    }
    return {
      ...summary,
      business: this.maskBusinessSecrets(summary.business),
    };
  }

  async createTenant(data: Partial<Business>): Promise<Business> {
    if (!data.name || !data.slug) {
      throw new BadRequestError('Business name and slug are required');
    }
    const existing = await this.tenantRepository.findBySlug(data.slug);
    if (existing) {
      throw new BadRequestError(`Slug '${data.slug}' is already taken`);
    }
    return this.tenantRepository.create(data);
  }

  async createBusinessWithAdmin(data: {
    // Business
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
    brandColor?: string;
    openingHours?: string;
    closingHours?: string;
    gpsCoordinates?: string;
    // Admin / Manager
    adminFullName?: string;
    managerFullName?: string;
    adminEmail?: string;
    managerEmail?: string;
    adminPhone?: string;
    managerPhone?: string;
    adminPassword?: string;
    managerPassword?: string;
    // Multi-tenant M-Pesa Model B fields
    mpesaConsumerKey?: string | null;
    mpesaConsumerSecret?: string | null;
    mpesaShortcode?: string | null;
    mpesaPasskey?: string | null;
    mpesaTransactionType?: string | null;
    mpesaEnvironment?: string | null;
    isMpesaActive?: boolean;
  }) {
    // Ensure slug is clean and guaranteed unique across all database records
    const baseSlug = (data.slug || data.name || 'business')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `biz-${Date.now()}`;

    let finalSlug = baseSlug;
    let counter = 1;

    while (await prisma.business.findFirst({ where: { slug: { equals: finalSlug, mode: 'insensitive' } } })) {
      counter++;
      finalSlug = `${baseSlug}-${counter}`;
      if (counter > 20) {
        finalSlug = `${baseSlug}-${Date.now().toString(36)}`;
        break;
      }
    }

    const adminEmail = (data.adminEmail || data.managerEmail || '').trim().toLowerCase();
    if (adminEmail) {
      const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (existingUser) {
        throw new BadRequestError(`An account with email '${adminEmail}' already exists`);
      }
    }

    const rawPassword = data.adminPassword || data.managerPassword;
    if (!rawPassword) {
      throw new BadRequestError('Initial admin password is required');
    }

    const adminPasswordHash = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

    const encryptedConsumerSecret = data.mpesaConsumerSecret
      ? encryptCredential(data.mpesaConsumerSecret)
      : null;
    const encryptedPasskey = data.mpesaPasskey
      ? encryptCredential(data.mpesaPasskey)
      : null;

    const result = await this.tenantRepository.createBusinessWithAdmin({
      name: data.name,
      slug: finalSlug,
      businessType: data.businessType,
      city: data.city,
      county: data.county,
      address: data.address,
      phone: data.phone,
      email: data.email,
      logoUrl: data.logoUrl,
      bannerUrl: data.bannerUrl,
      description: data.description,
      themeColor: data.themeColor || data.brandColor,
      openingHours: data.openingHours,
      closingHours: data.closingHours,
      gpsCoordinates: data.gpsCoordinates,
      adminPasswordHash,
      adminFullName: (data.adminFullName || data.managerFullName || 'Admin').trim(),
      adminEmail: (data.adminEmail || data.managerEmail || '').trim().toLowerCase(),
      adminPhone: data.adminPhone || data.managerPhone,
      mpesaConsumerKey: data.mpesaConsumerKey || null,
      mpesaConsumerSecret: encryptedConsumerSecret,
      mpesaShortcode: data.mpesaShortcode || null,
      mpesaPasskey: encryptedPasskey,
      mpesaTransactionType: data.mpesaTransactionType || 'CustomerPayBillOnline',
      mpesaEnvironment: data.mpesaEnvironment || 'sandbox',
      isMpesaActive: Boolean(data.isMpesaActive),
    });

    // Dispatch welcome email with credentials via Resend (fire-and-forget)
    if (result.admin?.email && rawPassword) {
      emailService
        .sendUserCredentialsEmail({
          email: result.admin.email,
          fullName: result.admin.fullName,
          rawPassword,
          role: result.admin.role,
          businessName: result.business?.name,
          mustChangePassword: result.admin.mustChangePassword,
        })
        .catch((err) => {
          logger.error(`Failed to send admin credentials email to ${result.admin.email}:`, err);
        });
    }

    return {
      business: this.maskBusinessSecrets(result.business),
      admin: result.admin,
    };
  }

  // Alias for backward compatibility
  async createClubWithManager(data: any) {
    return this.createBusinessWithAdmin(data);
  }

  async updateTenant(businessUuid: string, data: Partial<Business>): Promise<Business> {
    await this.getTenantById(businessUuid);
    const updateData: any = { ...data };

    if ('brandColor' in updateData) {
      if (!updateData.themeColor && updateData.brandColor) {
        updateData.themeColor = updateData.brandColor;
      }
      delete updateData.brandColor;
    }

    // Encrypt sensitive M-Pesa credentials if updated
    if ('mpesaConsumerSecret' in data) {
      const val = data.mpesaConsumerSecret;
      if (val && typeof val === 'string' && !val.includes('•')) {
        updateData.mpesaConsumerSecret = encryptCredential(val);
      } else if (val && typeof val === 'string' && val.includes('•')) {
        // Keep existing secret if mask placeholder sent
        delete updateData.mpesaConsumerSecret;
      } else {
        updateData.mpesaConsumerSecret = null;
      }
    }

    if ('mpesaPasskey' in data) {
      const val = data.mpesaPasskey;
      if (val && typeof val === 'string' && !val.includes('•')) {
        updateData.mpesaPasskey = encryptCredential(val);
      } else if (val && typeof val === 'string' && val.includes('•')) {
        // Keep existing passkey if mask placeholder sent
        delete updateData.mpesaPasskey;
      } else {
        updateData.mpesaPasskey = null;
      }
    }

    const updated = await this.tenantRepository.update(businessUuid, updateData);
    return this.maskBusinessSecrets(updated);
  }

  async suspendTenant(businessUuid: string): Promise<Business> {
    await this.getTenantById(businessUuid);
    return this.tenantRepository.update(businessUuid, {
      isActive: false,
      status: BusinessStatus.SUSPENDED,
      subscriptionStatus: SubscriptionStatus.SUSPENDED,
    });
  }

  async activateTenant(businessUuid: string): Promise<Business> {
    await this.getTenantById(businessUuid);
    return this.tenantRepository.update(businessUuid, {
      isActive: true,
      status: BusinessStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    });
  }

  async deleteTenant(businessUuid: string): Promise<boolean> {
    await this.getTenantById(businessUuid);
    return this.tenantRepository.delete(businessUuid);
  }

  async assignManager(businessUuid: string, userUuid: string) {
    await this.getTenantById(businessUuid);
    return this.tenantRepository.assignManager(businessUuid, userUuid);
  }

  async getTables(businessUuid: string) {
    await this.getTenantById(businessUuid);
    return this.tenantRepository.getTables(businessUuid);
  }

  async generateQrCodes(businessUuid: string, tableCount: number, sectionName: string, startFrom?: number) {
    await this.getTenantById(businessUuid);
    return this.tenantRepository.generateTablesAndQrs(businessUuid, tableCount, sectionName, startFrom);
  }

  async deleteTable(businessUuid: string, tableNumber: number) {
    await this.getTenantById(businessUuid);
    return this.tenantRepository.deleteTable(businessUuid, tableNumber);
  }
}

