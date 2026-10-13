/**
 * Business Repository
 *
 * All queries are strictly scoped by the verified businessUuid.
 */

import { Business } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  BusinessProfileDTO,
  UpdateBusinessProfileInput,
  UpdateBusinessSettingsInput,
  WeeklyOperatingSchedule,
} from './business.interface';

export class BusinessRepository {
  /**
   * Find a Business by primary UUID.
   */
  async findBusinessById(businessUuid: string): Promise<Business | null> {
    return prisma.business.findFirst({
      where: {
        businessUuid,
        deletedAt: null,
      },
    });
  }

  /**
   * Format a raw Prisma Business model into a clean BusinessProfileDTO.
   */
  toDTO(business: Business): BusinessProfileDTO {
    return {
      id: business.businessUuid,
      name: business.name,
      slug: business.slug,
      businessType: business.businessType,
      description: (business as any).description || null,
      email: business.email || null,
      phone: business.phone || null,
      address: business.address || null,
      city: business.city,
      county: business.county,
      country: (business as any).country || 'Kenya',
      logoUrl: business.logoUrl || null,
      bannerUrl: business.bannerUrl || null,
      themeColor: business.themeColor,
      timezone: (business as any).timezone || 'Africa/Nairobi',
      currency: (business as any).currency || 'KES',
      openingHours: business.openingHours,
      closingHours: business.closingHours,
      operatingSchedule: (business as any).operatingSchedule as WeeklyOperatingSchedule | null,
      status: business.status,
      mpesaShortcode: (business as any).mpesaShortcode || null,
      mpesaPasskey: (business as any).mpesaPasskey || null,
      mpesaTransactionType: (business as any).mpesaTransactionType || 'CustomerPayBillOnline',
      isMpesaActive: (business as any).isMpesaActive ?? false,
      createdAt: business.createdAt.toISOString(),
      updatedAt: business.updatedAt.toISOString(),
    };
  }

  /**
   * Update permitted business profile fields.
   */
  async updateBusinessProfile(
    businessUuid: string,
    data: UpdateBusinessProfileInput,
  ): Promise<Business> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.county !== undefined) updateData.county = data.county;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
    if (data.themeColor !== undefined) updateData.themeColor = data.themeColor;

    return prisma.business.update({
      where: { businessUuid },
      data: updateData,
    });
  }

  /**
   * Update permitted business operational and branding settings.
   */
  async updateBusinessSettings(
    businessUuid: string,
    data: UpdateBusinessSettingsInput,
  ): Promise<Business> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.themeColor !== undefined) updateData.themeColor = data.themeColor;
    if (data.openingHours !== undefined) updateData.openingHours = data.openingHours;
    if (data.closingHours !== undefined) updateData.closingHours = data.closingHours;
    if (data.operatingSchedule !== undefined) {
      updateData.operatingSchedule = data.operatingSchedule as any;
    }
    if (data.mpesaShortcode !== undefined) updateData.mpesaShortcode = data.mpesaShortcode;
    if (data.mpesaPasskey !== undefined) updateData.mpesaPasskey = data.mpesaPasskey;
    if (data.mpesaTransactionType !== undefined) updateData.mpesaTransactionType = data.mpesaTransactionType;
    if (data.isMpesaActive !== undefined) updateData.isMpesaActive = data.isMpesaActive;

    return prisma.business.update({
      where: { businessUuid },
      data: updateData,
    });
  }

  /**
   * Update business logo URL.
   */
  async updateLogo(businessUuid: string, logoUrl: string): Promise<Business> {
    return prisma.business.update({
      where: { businessUuid },
      data: {
        logoUrl,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Record audit log for business changes.
   */
  async createAuditLog(data: {
    businessUuid: string;
    userUuid: string;
    action: string;
    entityType: string;
    entityUuid: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          businessUuid: data.businessUuid,
          userUuid: data.userUuid,
          action: data.action,
          entityType: data.entityType,
          entityUuid: data.entityUuid,
          oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : undefined,
          newValues: data.newValues ? JSON.parse(JSON.stringify(data.newValues)) : undefined,
          ipAddress: data.ipAddress,
        },
      });
    } catch {
      // Audit logging errors should not block main transactions
    }
  }
}
