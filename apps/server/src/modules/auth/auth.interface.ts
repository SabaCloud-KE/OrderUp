import { User, UserSession, RefreshToken } from '@prisma/client';

export interface IAuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(userUuid: string): Promise<User | null>;
  findByEmailVerificationToken(token: string): Promise<User | null>;
  findByResetPasswordToken(token: string): Promise<User | null>;
  createUser(data: Partial<User>): Promise<User>;
  updateUser(userUuid: string, data: Partial<User>): Promise<User>;
  createSession(userUuid: string, businessUuid?: string, ipAddress?: string, userAgent?: string): Promise<UserSession>;
  invalidateSession(sessionUuid: string): Promise<void>;
  createRefreshToken(sessionUuid: string, userUuid: string, tokenHash: string, expiresAt: Date): Promise<RefreshToken>;
  findRefreshToken(tokenHash: string): Promise<(RefreshToken & { session: UserSession; user: User }) | null>;
  revokeRefreshToken(tokenUuid: string): Promise<void>;
}

