/**
 * Waiter Service
 *
 * Business logic layer enforcing:
 *   - Live ADMIN database validation (eliminates stale JWT claims)
 *   - Strict tenant isolation (all ops scoped to live ADMIN's business)
 *   - Role lock (role forced to WAITER server-side)
 *   - bcrypt password hashing (cost factor 12)
 *   - Duplicate email prevention (global uniqueness)
 *   - Audit logging for all mutating operations
 *   - Session + refresh token revocation on deactivation/reset/delete
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../common/errors/app-error';
import { UserRole } from '@orderup/shared';
import { WaiterRepository } from './waiter.repository';
import {
  CreateWaiterInput,
  UpdateWaiterInput,
  ResetWaiterPasswordInput,
  ResetWaiterPasswordResult,
  WaiterDetail,
  WaiterQueryFilters,
  PaginatedWaiters,
} from './waiter.interface';

const BCRYPT_ROUNDS = 12;

export class WaiterService {
  constructor(private waiterRepository: WaiterRepository) {}

  /**
   * Validate that the acting user is a live, active ADMIN with an active business.
   * Returns the verified businessUuid and admin's userUuid.
   * This eliminates reliance on stale JWT claims for tenant scope.
   */
  private async validateActingAdmin(adminUserId: string): Promise<{
    businessUuid: string;
    adminUserUuid: string;
  }> {
    const user = await prisma.user.findFirst({
      where: { userUuid: adminUserId, deletedAt: null },
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
      throw new UnauthorizedError(
        'User account not found or has been deleted. Please log in again.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedError(
        'Your account has been deactivated. Please contact support.',
      );
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError(
        'Insufficient permissions: Only Business Administrators can manage Waiters.',
      );
    }

    if (
      !user.businessUuid ||
      !user.business ||
      !user.business.isActive ||
      user.business.deletedAt !== null
    ) {
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
   * List all Waiters for the authenticated Admin's business.
   */
  async getWaiters(
    adminUserId: string,
    filters: WaiterQueryFilters,
  ): Promise<PaginatedWaiters> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    return this.waiterRepository.findWaiters(businessUuid, filters);
  }

  /**
   * View details of a single Waiter belonging to the authenticated Admin's business.
   */
  async getWaiterById(adminUserId: string, waiterUuid: string): Promise<WaiterDetail> {
    const { businessUuid } = await this.validateActingAdmin(adminUserId);
    const waiter = await this.waiterRepository.findWaiterById(waiterUuid, businessUuid);

    if (!waiter) {
      throw new NotFoundError('Waiter not found');
    }

    return waiter;
  }

  /**
   * Create a new Waiter account strictly for the authenticated Admin's business.
   * Role is forced to WAITER server-side. businessUuid is derived from the live DB record.
   */
  async createWaiter(
    adminUserId: string,
    input: CreateWaiterInput,
    ipAddress?: string,
  ): Promise<WaiterDetail> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    // 1. Global email uniqueness check
    const existing = await this.waiterRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('A user account with this email address already exists.');
    }

    // 2. Hash password securely
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // 3. Create waiter in DB (role hardcoded to WAITER)
    const created = await this.waiterRepository.createWaiter({
      businessUuid,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      passwordHash,
    });

    // 4. Audit log (no passwords ever logged)
    await this.waiterRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'WAITER_CREATED',
      entityType: 'USER',
      entityUuid: created.userUuid,
      newValues: {
        fullName: created.fullName,
        email: created.email,
        phone: created.phone,
        role: created.role,
        isActive: created.isActive,
      },
      ipAddress,
    });

    const waiterDetail = await this.waiterRepository.findWaiterById(
      created.userUuid,
      businessUuid,
    );

    if (!waiterDetail) {
      throw new NotFoundError('Waiter created but could not be retrieved.');
    }

    return waiterDetail;
  }

  /**
   * Update permitted Waiter information (fullName, email, phone only).
   */
  async updateWaiter(
    adminUserId: string,
    waiterUuid: string,
    input: UpdateWaiterInput,
    ipAddress?: string,
  ): Promise<WaiterDetail> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    const existing = await this.waiterRepository.findWaiterById(waiterUuid, businessUuid);
    if (!existing) {
      throw new NotFoundError('Waiter not found');
    }

    // Email uniqueness check if email is being changed
    if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
      const conflict = await this.waiterRepository.findUserByEmail(input.email);
      if (conflict && conflict.userUuid !== waiterUuid) {
        throw new ConflictError('A user account with this email address already exists.');
      }
    }

    const updatePayload: { fullName?: string; email?: string; phone?: string } = {};
    if (input.fullName !== undefined) updatePayload.fullName = input.fullName.trim();
    if (input.email !== undefined)
      updatePayload.email = input.email.trim().toLowerCase();
    if (input.phone !== undefined)
      updatePayload.phone = input.phone.trim() || undefined;

    await this.waiterRepository.updateWaiter(waiterUuid, businessUuid, updatePayload);

    await this.waiterRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'WAITER_UPDATED',
      entityType: 'USER',
      entityUuid: waiterUuid,
      oldValues: {
        fullName: existing.fullName,
        email: existing.email,
        phone: existing.phone,
      },
      newValues: updatePayload,
      ipAddress,
    });

    const updated = await this.waiterRepository.findWaiterById(
      waiterUuid,
      businessUuid,
    );
    if (!updated) {
      throw new NotFoundError('Waiter updated but could not be retrieved.');
    }

    return updated;
  }

  /**
   * Reset waiter password securely and revoke all active sessions.
   */
  async resetWaiterPassword(
    adminUserId: string,
    waiterUuid: string,
    input: ResetWaiterPasswordInput,
    ipAddress?: string,
  ): Promise<ResetWaiterPasswordResult> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    const existing = await this.waiterRepository.findWaiterById(
      waiterUuid,
      businessUuid,
    );
    if (!existing) {
      throw new NotFoundError('Waiter not found');
    }

    // Use provided password or generate a secure random one
    const tempPassword =
      input.temporaryPassword && input.temporaryPassword.trim().length >= 6
        ? input.temporaryPassword.trim()
        : `Wt${crypto.randomBytes(4).toString('hex')}!`;

    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    await this.waiterRepository.resetWaiterPassword(
      waiterUuid,
      businessUuid,
      passwordHash,
    );

    // Audit log — plaintext password NEVER logged
    await this.waiterRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'WAITER_PASSWORD_RESET_INITIATED',
      entityType: 'USER',
      entityUuid: waiterUuid,
      newValues: {
        mustChangePassword: true,
        resetInitiatedAt: new Date().toISOString(),
      },
      ipAddress,
    });

    return {
      waiterUuid,
      fullName: existing.fullName,
      email: existing.email,
      temporaryPassword: tempPassword,
      message: `Password reset initiated for ${existing.fullName}. The waiter will be required to change this password on next login.`,
    };
  }

  /**
   * Activate or Deactivate a Waiter.
   * Deactivation immediately revokes all sessions and tokens.
   */
  async setWaiterStatus(
    adminUserId: string,
    waiterUuid: string,
    isActive: boolean,
    ipAddress?: string,
  ): Promise<{ waiterUuid: string; isActive: boolean; message: string }> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    const existing = await this.waiterRepository.findWaiterById(
      waiterUuid,
      businessUuid,
    );
    if (!existing) {
      throw new NotFoundError('Waiter not found');
    }

    await this.waiterRepository.updateWaiterStatus(waiterUuid, businessUuid, isActive);

    await this.waiterRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: isActive ? 'WAITER_ACTIVATED' : 'WAITER_DEACTIVATED',
      entityType: 'USER',
      entityUuid: waiterUuid,
      oldValues: { isActive: existing.isActive },
      newValues: { isActive },
      ipAddress,
    });

    return {
      waiterUuid,
      isActive,
      message: `Waiter ${existing.fullName} is now ${isActive ? 'active' : 'suspended'}.`,
    };
  }

  /**
   * Soft-delete a Waiter account.
   * Historical records (orders, audit logs) are preserved in the database.
   */
  async deleteWaiter(
    adminUserId: string,
    waiterUuid: string,
    ipAddress?: string,
  ): Promise<{ waiterUuid: string; message: string }> {
    const { businessUuid, adminUserUuid } = await this.validateActingAdmin(adminUserId);

    const existing = await this.waiterRepository.findWaiterById(
      waiterUuid,
      businessUuid,
    );
    if (!existing) {
      throw new NotFoundError('Waiter not found');
    }

    await this.waiterRepository.softDeleteWaiter(waiterUuid, businessUuid);

    await this.waiterRepository.createAuditLog({
      businessUuid,
      userUuid: adminUserUuid,
      action: 'WAITER_DELETED',
      entityType: 'USER',
      entityUuid: waiterUuid,
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
      waiterUuid,
      message: `Waiter ${existing.fullName} has been removed successfully.`,
    };
  }
}
