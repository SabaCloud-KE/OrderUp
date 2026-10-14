import { z } from 'zod';

export const strongPasswordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password cannot exceed 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9\s]/, 'Password must contain at least one special symbol (like !, @, #, or $)');

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    rememberMe: z.boolean().optional().default(false),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: strongPasswordSchema,
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
    email: z.string().min(1, 'Email is required'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: strongPasswordSchema,
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
    newPassword: strongPasswordSchema,
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPasswordSchema,
  }),
});

