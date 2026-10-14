import { z } from 'zod';
import { BusinessType } from '@orderup/shared';

const businessTypeEnum = z.nativeEnum(BusinessType).optional().default(BusinessType.RESTAURANT);

export const createBusinessSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Business name must be at least 2 characters'),
    slug: z.string().min(2, 'Slug must be at least 2 characters'),
    businessType: businessTypeEnum,
    logoUrl: z.string().optional().nullable().or(z.literal('')),
    bannerUrl: z.string().optional().nullable().or(z.literal('')),
    description: z.string().optional().nullable().or(z.literal('')),
    phone: z.string().optional().nullable().or(z.literal('')),
    email: z.string().optional().nullable().or(z.literal('')),
    city: z.string().optional().default('Nairobi'),
    county: z.string().optional().default('Nairobi'),
    address: z.string().optional().nullable().or(z.literal('')),
    gpsCoordinates: z.string().optional().nullable().or(z.literal('')),
    themeColor: z.string().optional().default('#e11d48'),
    brandColor: z.string().optional(),
    openingHours: z.string().optional().default('08:00'),
    closingHours: z.string().optional().default('23:00'),
  }),
});

export const createClubSchema = createBusinessSchema;

export const createBusinessWithAdminSchema = z.object({
  body: z.object({
    // Business fields
    name: z.string().min(2, 'Business name must be at least 2 characters'),
    slug: z
      .string()
      .min(2, 'Slug must be at least 2 characters')
      .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
    businessType: businessTypeEnum,
    logoUrl: z.string().optional().nullable().or(z.literal('')),
    bannerUrl: z.string().optional().nullable().or(z.literal('')),
    description: z.string().optional().nullable().or(z.literal('')),
    phone: z.string().optional().nullable().or(z.literal('')),
    email: z.string().optional().nullable().or(z.literal('')),
    city: z.string().optional().default('Nairobi'),
    county: z.string().optional().default('Nairobi'),
    address: z.string().optional().nullable().or(z.literal('')),
    gpsCoordinates: z.string().optional().nullable().or(z.literal('')),
    themeColor: z.string().optional().default('#e11d48'),
    brandColor: z.string().optional(),
    openingHours: z.string().optional().default('08:00'),
    closingHours: z.string().optional().default('23:00'),
    // Admin / Manager fields (support both naming conventions)
    adminFullName: z.string().min(2, 'Admin name must be at least 2 characters').optional(),
    managerFullName: z.string().min(2, 'Manager name must be at least 2 characters').optional(),
    adminEmail: z.string().min(1, 'Admin email is required').optional(),
    managerEmail: z.string().min(1, 'Manager email is required').optional(),
    adminPhone: z.string().optional().nullable().or(z.literal('')),
    managerPhone: z.string().optional().nullable().or(z.literal('')),
    adminPassword: z.string().min(8, 'Temporary password must be at least 8 characters').optional(),
    managerPassword: z.string().min(8, 'Temporary password must be at least 8 characters').optional(),
  }),
});

export const createClubWithManagerSchema = createBusinessWithAdminSchema;

export const updateBusinessSchema = z.object({
  params: z.object({
    businessUuid: z.string().uuid('Invalid Business UUID').optional(),
    clubUuid: z.string().uuid('Invalid Club UUID').optional(),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    businessType: z.nativeEnum(BusinessType).optional(),
    logoUrl: z.string().optional().nullable().or(z.literal('')),
    bannerUrl: z.string().optional().nullable().or(z.literal('')),
    description: z.string().optional().nullable().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')).or(z.null()),
    email: z.string().optional().or(z.literal('')).or(z.null()),
    city: z.string().optional(),
    county: z.string().optional(),
    address: z.string().optional().or(z.literal('')).or(z.null()),
    gpsCoordinates: z.string().optional().or(z.literal('')).or(z.null()),
    themeColor: z.string().optional(),
    brandColor: z.string().optional(),
    openingHours: z.string().optional(),
    closingHours: z.string().optional(),
    isActive: z.boolean().optional(),
    mpesaShortcode: z.string().optional().nullable().or(z.literal('')),
    mpesaPasskey: z.string().optional().nullable().or(z.literal('')),
    mpesaTransactionType: z.enum(['CustomerPayBillOnline', 'CustomerBuyGoodsOnline']).optional(),
    isMpesaActive: z.boolean().optional(),
  }),
});

export const updateClubSchema = updateBusinessSchema;

export const assignManagerSchema = z.object({
  params: z.object({
    businessUuid: z.string().uuid('Invalid Business UUID').optional(),
    clubUuid: z.string().uuid('Invalid Club UUID').optional(),
  }),
  body: z.object({
    userUuid: z.string().uuid('Invalid User UUID'),
  }),
});

export const generateQrCodesSchema = z.object({
  params: z.object({
    businessUuid: z.string().uuid('Invalid Business UUID').optional(),
    clubUuid: z.string().uuid('Invalid Club UUID').optional(),
  }),
  body: z.object({
    tableCount: z.number().int().min(1).max(200),
    sectionName: z.string().optional().default('Main Floor'),
    startFrom: z.number().int().min(1).optional(),
  }),
});

