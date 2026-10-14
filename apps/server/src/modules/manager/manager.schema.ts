/**
 * Manager Validation Schemas
 *
 * Strict request validation ensuring:
 *   - No client-supplied roles (role cannot be injected or escalated)
 *   - No client-supplied business identifiers (businessUuid, clubUuid, tenantId)
 *   - Clean inputs and formatted types
 */

import { z } from 'zod';

export const createManagerSchema = z.object({
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

export const updateManagerSchema = z.object({
  params: z.object({
    managerUuid: z.string().uuid('Invalid Manager UUID format'),
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

export const updateManagerStatusSchema = z.object({
  params: z.object({
    managerUuid: z.string().uuid('Invalid Manager UUID format'),
  }),
  body: z
    .object({
      isActive: z.boolean({ required_error: 'isActive boolean flag is required' }),
    })
    .strict({ message: 'Unrecognized or unauthorized fields in request body' }),
});

export const resetPasswordManagerSchema = z.object({
  params: z.object({
    managerUuid: z.string().uuid('Invalid Manager UUID format'),
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

export const getManagerParamsSchema = z.object({
  params: z.object({
    managerUuid: z.string().uuid('Invalid Manager UUID format'),
  }),
});

export const listManagersQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'fullName', 'email']).optional(),
    sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  }),
});
