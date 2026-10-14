import { z } from 'zod';

export const loginSchema = z.object({
  body: z
    .object({
      username: z.string().optional(),
      email: z.string().optional(),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      rememberMe: z.boolean().optional().default(false),
    })
    .refine((data) => !!(data.username?.trim() || data.email?.trim()), {
      message: 'Username or email is required',
      path: ['username'],
    }),
});

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(2, 'Username must be at least 2 characters').max(100).optional(),
    email: z.string().min(1, 'Username or email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    phone: z.string().optional(),
    role: z
      .enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'WAITER', 'CUSTOMER'])
      .optional()
      .default('WAITER'),
    businessUuid: z.string().uuid().optional(),
    clubUuid: z.string().uuid().optional(),
    mustChangePassword: z.boolean().optional().default(false),
  }),
});


export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Username or email is required'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
});

export const firstLoginPasswordChangeSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});
