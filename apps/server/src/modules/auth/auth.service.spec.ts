import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { IAuthRepository } from './auth.interface';
import bcrypt from 'bcrypt';

describe('AuthService Unit Tests', () => {
  let authService: AuthService;
  let mockAuthRepository: IAuthRepository;

  beforeEach(() => {
    mockAuthRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findByEmailVerificationToken: vi.fn(),
      findByResetPasswordToken: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      createSession: vi.fn(),
      invalidateSession: vi.fn(),
      createRefreshToken: vi.fn(),
      findRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
    };

    authService = new AuthService(mockAuthRepository);
  });

  describe('login', () => {
    it('should authenticate user and return token pair on valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 12);
      const mockUser: any = {
        userUuid: 'user-uuid-123',
        email: 'waiter@alchemist.co.ke',
        passwordHash: hashedPassword,
        fullName: 'John Waiter',
        role: 'WAITER',
        mustChangePassword: false,
        emailVerified: true,
        isActive: true,
        clubUuid: 'club-uuid-123',
      };

      vi.spyOn(mockAuthRepository, 'findByEmail').mockResolvedValue(mockUser);
      vi.spyOn(mockAuthRepository, 'createSession').mockResolvedValue({ sessionUuid: 'sess-123' } as any);
      vi.spyOn(mockAuthRepository, 'createRefreshToken').mockResolvedValue({ tokenUuid: 'token-123' } as any);

      const result = await authService.login('waiter@alchemist.co.ke', 'Password123!');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('waiter@alchemist.co.ke');
    });

    it('should throw UnauthorizedError on invalid password', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 12);
      vi.spyOn(mockAuthRepository, 'findByEmail').mockResolvedValue({
        passwordHash: hashedPassword,
        isActive: true,
      } as any);

      await expect(authService.login('waiter@alchemist.co.ke', 'WrongPassword')).rejects.toThrow(
        'Invalid email or password',
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify user email on valid token', async () => {
      vi.spyOn(mockAuthRepository, 'findByEmailVerificationToken').mockResolvedValue({
        userUuid: 'user-123',
      } as any);
      vi.spyOn(mockAuthRepository, 'updateUser').mockResolvedValue({} as any);

      await authService.verifyEmail('valid-token-123');

      expect(mockAuthRepository.updateUser).toHaveBeenCalledWith('user-123', {
        emailVerified: true,
        emailVerificationToken: null,
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password on valid reset token', async () => {
      vi.spyOn(mockAuthRepository, 'findByResetPasswordToken').mockResolvedValue({
        userUuid: 'user-123',
      } as any);
      vi.spyOn(mockAuthRepository, 'updateUser').mockResolvedValue({} as any);

      await authService.resetPassword('reset-token-123', 'NewPassword123!');

      expect(mockAuthRepository.updateUser).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          resetPasswordToken: null,
          mustChangePassword: false,
        }),
      );
    });
  });
});
