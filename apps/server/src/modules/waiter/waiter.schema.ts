/**
 * Waiter Validation Schemas
 *
 * Strict request validation using Zod .strict() to ensure:
 *   - No client-supplied role (prevented from role escalation)
 *   - No client-supplied business identifiers (businessUuid, clubUuid, tenantId)
 *   - No injection of sensitive fields (passwordHash, isActive, mustChangePassword, deletedAt)
 */

import { z } from 'zod';

export const createWaiterSchema = z.object({
  body: z
    .object({
      fullName: z
        .string({ required_error: 'Full name is required' })
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name cannot exceed 100 characters')
        .trim(),
      email: z
        .string({ required_error: 'Email address is required' })
        .email('Invalid email address')
        .max(150, 'Email cannot exceed 150 characters')
        .trim()
        .toLowerCase(),
      phone: z
        .string()
        .max(30, 'Phone number cannot exceed 30 characters')
        .trim()
        .optional()
        .or(z.literal('')),
      password: z
        .string({ required_error: 'Password is required' })
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password cannot exceed 100 characters'),
    })
    .strict({ message: 'Unrecognized or unauthorized fields in request body' }),
});

export const updateWaiterSchema = z.object({
  params: z.object({
    waiterUuid: z.string().uuid('Invalid Waiter UUID format'),
  }),
  body: z
    .object({
      fullName: z
        .string()
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name cannot exceed 100 characters')
        .trim()
        .optional(),
      email: z
        .string()
        .email('Invalid email address')
        .max(150, 'Email cannot exceed 150 characters')
        .trim()
        .toLowerCase()
        .optional(),
      phone: z
        .string()
        .max(30, 'Phone number cannot exceed 30 characters')
        .trim()
        .optional()
        .or(z.literal('')),
    })
    .strict({ message: 'Unrecognized or unauthorized fields in request body' }),
});

export const updateWaiterStatusSchema = z.object({
  params: z.object({
    waiterUuid: z.string().uuid('Invalid Waiter UUID format'),
  }),
  body: z
    .object({
      isActive: z.boolean({ required_error: 'isActive boolean flag is required' }),
    })
    .strict({ message: 'Unrecognized or unauthorized fields in request body' }),
});

export const resetPasswordWaiterSchema = z.object({
  params: z.object({
    waiterUuid: z.string().uuid('Invalid Waiter UUID format'),
  }),
  body: z
    .object({
      temporaryPassword: z
        .string()
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password cannot exceed 100 characters')
        .optional(),
    })
    .strict({ message: 'Unrecognized or unauthorized fields in request body' })
    .optional(),
});

export const getWaiterParamsSchema = z.object({
  params: z.object({
    waiterUuid: z.string().uuid('Invalid Waiter UUID format'),
  }),
});

export const listWaitersQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'fullName', 'email']).optional(),
    sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  }),
});
