/**
 * Business Service
 *
 * Business logic layer enforcing:
 *   - Live acting Admin database validation (eliminating stale JWT claims)
 *   - Strict tenant isolation (all operations scoped to authenticated Admin's business)
 *   - Rejection of unauthorized platform field modifications
 *   - Audit logging for all profile, branding, and operational setting changes
 */

import { prisma } from '../../config/prisma';
import {
  UnauthorizedError,
  ForbiddenError,
} from '../../common/errors/app-error';
import { UserRole } from '@orderup/shared';
import { BusinessRepository } from './business.repository';
import {
  BusinessProfileDTO,
  UpdateBusinessProfileInput,
  UpdateBusinessSettingsInput,
} from './business.interface';

export class BusinessService {
  constructor(private businessRepository: BusinessRepository) {}

  /**
   * Validate that the acting user is a live, active ADMIN assigned to an active business.
   * Returns the verified businessUuid, admin's userUuid, and the Business entity.
   */
  private async validateActingAdmin(adminUserId: string) {
    const user = await prisma.user.findFirst({
      where: {
        userUuid: adminUserId,
        deletedAt: null,
      },
      select: {
        userUuid: true,
        role: true,
        isActive: true,
        businessUuid: true,
        business: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found or has been deleted. Please log in again.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Insufficient permissions: Only Business Administrators can manage Business Profile and Settings.');
    }

    if (!user.businessUuid || !user.business || !user.business.isActive || user.business.deletedAt !== null) {
      throw new ForbiddenError(
        'Your account is not associated with an active business. Please contact your platform administrator.',
      );
    }

    return {
      businessUuid: user.businessUuid,
      adminUserUuid: user.userUuid,
      business: user.business,
    };
  }

  /**
   * Retrieve the authenticated Admin's business profile and operational settings.
   */
  async getProfile(adminUserId: string): Promise<BusinessProfileDTO> {
    const { business } = await this.validateActingAdmin(adminUserId);
    return this.businessRepository.toDTO(business);
  }

  /**
   * Update permitted business profile fields.
   */
  async updateProfile(
    adminUserId: string,
    input: UpdateBusinessProfileInput,
    ipAddress?: string,
  ): Promise<BusinessProfileDTO> {
    const { businessUuid, adminUserUuid, business } = await this.validateActingAdmin(adminUserId);

    const oldValues = {
      name: business.name,
      description: (business as any).description,
      email: business.email,
      phone: business.phone,
      address: business.address,
      city: business.city,
      county: business.county,
      country: (business as any).country,
      logoUrl: business.logoUrl,
      bannerUrl: business.bannerUrl,
      themeColor: business.themeColor,
    };

    const updated = await this.businessRepository.updateBusinessProfile(businessUuid, input);

    // Audit logging
    await this.businessRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'BUSINESS_PROFILE_UPDATED',
      entityType: 'BUSINESS',
      entityUuid: businessUuid,
      oldValues,
      newValues: input,
      ipAddress,
    });

    if (input.themeColor !== undefined || input.logoUrl !== undefined) {
      await this.businessRepository.createAuditLog({
        businessUuid,
        userUuid: adminUserUuid,
        action: 'BUSINESS_BRANDING_UPDATED',
        entityType: 'BUSINESS',
        entityUuid: businessUuid,
        newValues: { themeColor: input.themeColor, logoUrl: input.logoUrl },
        ipAddress,
      });
    }

    return this.businessRepository.toDTO(updated);
  }

  /**
   * Update permitted business operational and branding settings.
   */
  async updateSettings(
    adminUserId: string,
    input: UpdateBusinessSettingsInput,
    ipAddress?: string,
  ): Promise<BusinessProfileDTO> {
    const { businessUuid, adminUserUuid, business } = await this.validateActingAdmin(adminUserId);

    const oldValues = {
      timezone: (business as any).timezone,
      currency: (business as any).currency,
      themeColor: business.themeColor,
      openingHours: business.openingHours,
      closingHours: business.closingHours,
      operatingSchedule: (business as any).operatingSchedule,
    };

    const updated = await this.businessRepository.updateBusinessSettings(businessUuid, input);

    // Audit logging
    await this.businessRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'BUSINESS_SETTINGS_UPDATED',
      entityType: 'BUSINESS',
      entityUuid: businessUuid,
      oldValues,
      newValues: input,
      ipAddress,
    });

    if (input.operatingSchedule !== undefined || input.openingHours !== undefined || input.closingHours !== undefined) {
      await this.businessRepository.createAuditLog({
        businessUuid,
        userUuid: adminUserUuid,
        action: 'BUSINESS_OPERATING_HOURS_UPDATED',
        entityType: 'BUSINESS',
        entityUuid: businessUuid,
        newValues: {
          operatingSchedule: input.operatingSchedule,
          openingHours: input.openingHours,
          closingHours: input.closingHours,
        },
        ipAddress,
      });
    }

    return this.businessRepository.toDTO(updated);
  }

  /**
   * Update business logo.
   */
  async uploadLogo(
    adminUserId: string,
    logoUrl: string,
    ipAddress?: string,
  ): Promise<{ logoUrl: string; profile: BusinessProfileDTO }> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    const updated = await this.businessRepository.updateLogo(businessUuid, logoUrl);

    await this.businessRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'BUSINESS_LOGO_UPDATED',
      entityType: 'BUSINESS',
      entityUuid: businessUuid,
      newValues: { logoUrl },
      ipAddress,
    });

    return {
      logoUrl,
      profile: this.businessRepository.toDTO(updated),
    };
  }
}
