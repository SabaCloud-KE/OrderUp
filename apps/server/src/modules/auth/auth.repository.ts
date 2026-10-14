import { User, UserSession, RefreshToken, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { IAuthRepository } from './auth.interface';

export class AuthRepository implements IAuthRepository {
  async findByEmail(email: string): Promise<User | null> {
    const trimmed = (email || '').trim();
    return prisma.user.findFirst({
      where: {
        email: { equals: trimmed, mode: 'insensitive' },
        deletedAt: null,
      },
      include: { business: true } as any,
    });
  }

  async findById(userUuid: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { userUuid, deletedAt: null },
      include: { business: true } as any,
    });
  }

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { emailVerificationToken: token, deletedAt: null },
    });
  }

  async findByResetPasswordToken(token: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
        deletedAt: null,
      },
    });
  }

  async createUser(data: Partial<User>): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email!,
        passwordHash: data.passwordHash!,
        fullName: data.fullName!,
        phone: data.phone,
        role: data.role || UserRole.WAITER,
        businessUuid: data.businessUuid,
        mustChangePassword: data.mustChangePassword || false,
        emailVerificationToken: data.emailVerificationToken,
      },
    });
  }

  async updateUser(userUuid: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({
      where: { userUuid },
      data,
    });
  }

  async createSession(
    userUuid: string,
    businessUuid?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserSession> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    return prisma.userSession.create({
      data: {
        userUuid,
        businessUuid,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });
  }

  async invalidateSession(sessionUuid: string): Promise<void> {
    await prisma.userSession.update({
      where: { sessionUuid },
      data: { isValid: false },
    });
  }

  async createRefreshToken(
    sessionUuid: string,
    userUuid: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data: {
        sessionUuid,
        userUuid,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findRefreshToken(tokenHash: string): Promise<(RefreshToken & { session: UserSession; user: User }) | null> {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        session: true,
        user: true,
      },
    });
  }

  async revokeRefreshToken(tokenUuid: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { tokenUuid },
      data: { isRevoked: true },
    });
  }

  async touchUserSession(userUuid: string): Promise<void> {
    await prisma.userSession.updateMany({
      where: {
        userUuid,
        isValid: true,
        expiresAt: { gt: new Date() },
      },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  async deleteUser(userUuid: string): Promise<void> {
    await prisma.user.update({
      where: { userUuid },
      data: { deletedAt: new Date(), isActive: false },
    });
    await prisma.userSession.updateMany({
      where: { userUuid },
      data: { isValid: false },
    });
  }

  async listStaffByBusiness(businessUuid: string, role?: string): Promise<User[]> {
    const roleFilter = role ? { equals: role as UserRole } : undefined;

    return prisma.user.findMany({
      where: {
        businessUuid,
        deletedAt: null,
        ...(roleFilter ? { role: roleFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        business: true,
        sessions: {
          where: {
            isValid: true,
            expiresAt: { gt: new Date() },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      } as any,
    });
  }

  async listAllStaff(role?: string): Promise<User[]> {
    const roleFilter =
      role === 'ADMIN' || role === 'MANAGER'
        ? { in: [UserRole.ADMIN, UserRole.MANAGER] }
        : role
        ? { equals: role as UserRole }
        : undefined;

    return prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(roleFilter ? { role: roleFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        business: true,
        sessions: {
          where: {
            isValid: true,
            expiresAt: { gt: new Date() },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      } as any,
    });
  }

  async findAllUsers(filters: {
    role?: string;
    businessUuid?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<User[]> {
    const { role, businessUuid, isActive, search } = filters;

    let roleCondition: any = undefined;
    if (role && role !== 'ALL') {
      roleCondition = { equals: role as UserRole };
    }

    const searchCondition = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    return prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(roleCondition ? { role: roleCondition } : {}),
        ...(businessUuid && businessUuid !== 'ALL' ? { businessUuid } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...searchCondition,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        business: true,
        sessions: {
          where: {
            isValid: true,
            expiresAt: { gt: new Date() },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      } as any,
    });
  }
}

