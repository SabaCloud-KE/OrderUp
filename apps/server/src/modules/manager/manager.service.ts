/**
 * Manager Service
 *
 * Business logic layer enforcing:
 *   - Live acting Admin database validation (eliminating stale JWT claims)
 *   - Strict tenant isolation (all operations scoped to authenticated Admin's business)
 *   - Role assignment lock (role is forced to MANAGER server-side)
 *   - Password hashing with bcrypt (cost factor 12)
 *   - Duplicate email prevention
 *   - Audit logging for all mutating operations
 *   - Session/token invalidation on deactivation, soft-deletion, and password reset
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import { emailService } from '../notification/email.service';
import { logger } from '../../config/logger';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../common/errors/app-error';
import { UserRole } from '@orderup/shared';
import { ManagerRepository } from './manager.repository';
import {
  CreateManagerInput,
  UpdateManagerInput,
  ResetManagerPasswordInput,
  ResetManagerPasswordResult,
  ManagerDetail,
  ManagerQueryFilters,
  PaginatedManagers,
} from './manager.interface';

const BCRYPT_ROUNDS = 12;

export class ManagerService {
  constructor(private managerRepository: ManagerRepository) {}

  /**
   * Validate that the acting user is a live, active ADMIN assigned to an active business.
   * Returns the verified businessUuid and admin's userUuid.
   */
  private async validateActingAdmin(adminUserId: string): Promise<{
    businessUuid: string;
    adminUserUuid: string;
  }> {
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
        business: {
          select: {
            businessUuid: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found or has been deleted. Please log in again.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Insufficient permissions: Only Business Administrators can manage Managers.');
    }

    if (!user.businessUuid || !user.business || !user.business.isActive || user.business.deletedAt !== null) {
      throw new ForbiddenError(
        'Your account is not associated with an active business. Please contact your platform administrator.',
      );
    }

    return {
      businessUuid: user.businessUuid,
      adminUserUuid: user.userUuid,
    };
  }

  /**
   * List all Managers for the authenticated Admin's business with server-side filtering, sorting, and pagination.
   */
  async getManagers(adminUserId: string, filters: ManagerQueryFilters): Promise<PaginatedManagers> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    return this.managerRepository.findManagers(businessUuid, filters);
  }

  /**
   * View details of a single Manager belonging to the authenticated Admin's business.
   */
  async getManagerById(adminUserId: string, managerUuid: string): Promise<ManagerDetail> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const manager = await this.managerRepository.findManagerById(managerUuid, businessUuid);

    if (!manager) {
      throw new NotFoundError('Manager not found');
    }

    return manager;
  }

  /**
   * Create a new Manager account strictly for the authenticated Admin's business.
   * Role is forced to MANAGER server-side.
   */
  async createManager(
    adminUserId: string,
    input: CreateManagerInput,
    ipAddress?: string,
  ): Promise<ManagerDetail> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    // 1. Check global email uniqueness
    const existing = await this.managerRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('A user account with this email address already exists.');
    }

    // 2. Hash password securely
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // 3. Create Manager record in DB
    const createdUser = await this.managerRepository.createManager({
      businessUuid,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      passwordHash,
    });

    // 4. Audit Log
    await this.managerRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'MANAGER_CREATED',
      entityType: 'USER',
      entityUuid: createdUser.userUuid,
      newValues: {
        fullName: createdUser.fullName,
        email: createdUser.email,
        phone: createdUser.phone,
        role: createdUser.role,
        isActive: createdUser.isActive,
      },
      ipAddress,
    });

    const managerDetail = await this.managerRepository.findManagerById(
      createdUser.userUuid,
      businessUuid,
    );

    if (!managerDetail) {
      throw new NotFoundError('Manager created but could not be retrieved.');
    }

    // Dispatch welcome email with credentials via Resend (fire-and-forget)
    (async () => {
      const biz = await prisma?.business?.findUnique({
        where: { businessUuid },
        select: { name: true },
      });
      await emailService.sendUserCredentialsEmail({
        email: createdUser.email,
        fullName: createdUser.fullName,
        rawPassword: input.password,
        role: createdUser.role,
        businessName: biz?.name,
        mustChangePassword: createdUser.mustChangePassword,
      });
    })().catch((err) => {
      logger.error(`Failed to send manager credentials email to ${createdUser.email}:`, err);
    });

    return managerDetail;
  }

  /**
   * Update permitted Manager information.
   */
  async updateManager(
    adminUserId: string,
    managerUuid: string,
    input: UpdateManagerInput,
    ipAddress?: string,
  ): Promise<ManagerDetail> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    // 1. Verify Manager exists within the business scope
    const existing = await this.managerRepository.findManagerById(managerUuid, businessUuid);
    if (!existing) {
      throw new NotFoundError('Manager not found');
    }

    // 2. If email changed, check uniqueness
    if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailConflict = await this.managerRepository.findUserByEmail(input.email);
      if (emailConflict && emailConflict.userUuid !== managerUuid) {
        throw new ConflictError('A user account with this email address already exists.');
      }
    }

    const updatePayload: { fullName?: string; email?: string; phone?: string } = {};
    if (input.fullName !== undefined) updatePayload.fullName = input.fullName.trim();
    if (input.email !== undefined) updatePayload.email = input.email.trim().toLowerCase();
    if (input.phone !== undefined) updatePayload.phone = input.phone.trim() || undefined;

    // 3. Perform update
    await this.managerRepository.updateManager(managerUuid, businessUuid, updatePayload);

    // 4. Audit Log
    await this.managerRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'MANAGER_UPDATED',
      entityType: 'USER',
      entityUuid: managerUuid,
      oldValues: {
        fullName: existing.fullName,
        email: existing.email,
        phone: existing.phone,
      },
      newValues: updatePayload,
      ipAddress,
    });

    const updated = await this.managerRepository.findManagerById(managerUuid, businessUuid);
    if (!updated) {
      throw new NotFoundError('Manager updated but could not be retrieved.');
    }

    return updated;
  }

  /**
   * Reset manager password securely and revoke active sessions.
   */
  async resetManagerPassword(
    adminUserId: string,
    managerUuid: string,
    input: ResetManagerPasswordInput,
    ipAddress?: string,
  ): Promise<ResetManagerPasswordResult> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    const existing = await this.managerRepository.findManagerById(managerUuid, businessUuid);
    if (!existing) {
      throw new NotFoundError('Manager not found');
    }

    // Generate temporary password if not provided
    const tempPassword = input.temporaryPassword && input.temporaryPassword.trim().length >= 6
      ? input.temporaryPassword.trim()
      : `Mg${crypto.randomBytes(4).toString('hex')}!`;

    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    await this.managerRepository.resetManagerPassword(managerUuid, businessUuid, passwordHash);

    // Audit Log (never log password or hash)
    await this.managerRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'MANAGER_PASSWORD_RESET_INITIATED',
      entityType: 'USER',
      entityUuid: managerUuid,
      newValues: {
        mustChangePassword: true,
        resetInitiatedAt: new Date().toISOString(),
      },
      ipAddress,
    });

    return {
      managerUuid,
      fullName: existing.fullName,
      email: existing.email,
      temporaryPassword: tempPassword,
      message: `Password reset initiated for ${existing.fullName}. The manager will be required to change this password on next login.`,
    };
  }

  /**
   * Activate or Deactivate a Manager.
   */
  async setManagerStatus(
    adminUserId: string,
    managerUuid: string,
    isActive: boolean,
    ipAddress?: string,
  ): Promise<{ managerUuid: string; isActive: boolean; message: string }> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    const existing = await this.managerRepository.findManagerById(managerUuid, businessUuid);
    if (!existing) {
      throw new NotFoundError('Manager not found');
    }

    await this.managerRepository.updateManagerStatus(managerUuid, businessUuid, isActive);

    // Audit Log
    await this.managerRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: isActive ? 'MANAGER_ACTIVATED' : 'MANAGER_DEACTIVATED',
      entityType: 'USER',
      entityUuid: managerUuid,
      oldValues: { isActive: existing.isActive },
      newValues: { isActive },
      ipAddress,
    });

    return {
      managerUuid,
      isActive,
      message: `Manager ${existing.fullName} is now ${isActive ? 'active' : 'suspended'}.`,
    };
  }

  /**
   * Soft-delete a Manager account.
   */
  async deleteManager(
    adminUserId: string,
    managerUuid: string,
    ipAddress?: string,
  ): Promise<{ managerUuid: string; message: string }> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    const existing = await this.managerRepository.findManagerById(managerUuid, businessUuid);
    if (!existing) {
      throw new NotFoundError('Manager not found');
    }

    await this.managerRepository.softDeleteManager(managerUuid, businessUuid);

    // Audit Log
    await this.managerRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'MANAGER_DELETED',
      entityType: 'USER',
      entityUuid: managerUuid,
      oldValues: {
        fullName: existing.fullName,
        email: existing.email,
        isActive: existing.isActive,
      },
      newValues: {
        deletedAt: new Date().toISOString(),
        isActive: false,
      },
      ipAddress,
    });

    return {
      managerUuid,
      message: `Manager ${existing.fullName} has been removed successfully.`,
    };
  }
}
