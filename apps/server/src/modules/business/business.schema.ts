/**
 * Business Validation Schemas
 *
 * Strict request validation ensuring:
 *   - No client-supplied tenant identifiers (businessUuid, clubUuid, tenantId)
 *   - Protected platform fields (businessType, status, subscriptionStatus) cannot be altered by ADMIN
 *   - Theme color is strictly validated hex (#RRGGBB or #RGB) preventing CSS injection
 *   - Timezone and Currency validation
 *   - Day-by-day operating hours validation supporting overnight schedules
 */

import { z } from 'zod';

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const TIME_REGEX = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

export const isValidTimezone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const dayOperatingHoursSchema = z
  .object({
    isOpen: z.boolean({ required_error: 'isOpen flag is required' }),
    openingTime: z
      .string()
      .regex(TIME_REGEX, 'Opening time must be in HH:mm format (e.g. 08:00)')
      .nullable()
      .optional(),
    closingTime: z
      .string()
      .regex(TIME_REGEX, 'Closing time must be in HH:mm format (e.g. 23:00)')
      .nullable()
      .optional(),
    crossesMidnight: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.isOpen) {
        return !!data.openingTime && !!data.closingTime;
      }
      return true;
    },
    {
      message: 'When a day is marked open, both openingTime and closingTime are required',
    },
  );

export const weeklyOperatingScheduleSchema = z
  .object({
    monday: dayOperatingHoursSchema,
    tuesday: dayOperatingHoursSchema,
    wednesday: dayOperatingHoursSchema,
    thursday: dayOperatingHoursSchema,
    friday: dayOperatingHoursSchema,
    saturday: dayOperatingHoursSchema,
    sunday: dayOperatingHoursSchema,
  })
  .strict();

export const updateBusinessProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(2, 'Business name must be at least 2 characters')
        .max(100, 'Business name cannot exceed 100 characters')
        .trim()
        .optional(),
      description: z
        .string()
        .max(1000, 'Description cannot exceed 1000 characters')
        .trim()
        .nullable()
        .optional(),
      email: z
        .string()
        .email('Invalid email address')
        .max(150, 'Email cannot exceed 150 characters')
        .trim()
        .toLowerCase()
        .nullable()
        .optional(),
      phone: z
        .string()
        .max(30, 'Phone number cannot exceed 30 characters')
        .trim()
        .nullable()
        .optional(),
      address: z
        .string()
        .max(255, 'Address cannot exceed 255 characters')
        .trim()
        .nullable()
        .optional(),
      city: z
        .string()
        .min(2, 'City must be at least 2 characters')
        .max(100, 'City cannot exceed 100 characters')
        .trim()
        .optional(),
      county: z
        .string()
        .min(2, 'County must be at least 2 characters')
        .max(100, 'County cannot exceed 100 characters')
        .trim()
        .optional(),
      country: z
        .string()
        .min(2, 'Country must be at least 2 characters')
        .max(100, 'Country cannot exceed 100 characters')
        .trim()
        .optional(),
      logoUrl: z
        .string()
        .trim()
        .nullable()
        .optional(),
      bannerUrl: z
        .string()
        .trim()
        .nullable()
        .optional(),
      themeColor: z
        .string()
        .regex(
          HEX_COLOR_REGEX,
          'Theme color must be a valid hex color code (e.g. #2563EB or #FFF)',
        )
        .optional(),
    })
    .strict({ message: 'Unrecognized or unauthorized fields in request body' }),
});

export const updateBusinessSettingsSchema = z.object({
  body: z
    .object({
      timezone: z
        .string()
        .trim()
        .refine(isValidTimezone, { message: 'Invalid IANA timezone identifier (e.g. Africa/Nairobi)' })
        .optional(),
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .regex(CURRENCY_REGEX, 'Currency must be a 3-letter ISO 4217 code (e.g. KES, USD, EUR)')
        .optional(),
      themeColor: z
        .string()
        .regex(
          HEX_COLOR_REGEX,
          'Theme color must be a valid hex color code (e.g. #2563EB or #FFF)',
        )
        .optional(),
      operatingSchedule: weeklyOperatingScheduleSchema.optional(),
      openingHours: z
        .string()
        .regex(TIME_REGEX, 'Opening hours must be in HH:mm format (e.g. 08:00)')
        .optional(),
      closingHours: z
        .string()
        .regex(TIME_REGEX, 'Closing hours must be in HH:mm format (e.g. 23:00)')
        .optional(),
      mpesaShortcode: z
        .string()
        .trim()
        .max(20, 'Shortcode cannot exceed 20 characters')
        .nullable()
        .optional(),
      mpesaPasskey: z
        .string()
        .trim()
        .nullable()
        .optional(),
      mpesaTransactionType: z
        .enum(['CustomerPayBillOnline', 'CustomerBuyGoodsOnline'])
        .optional(),
      isMpesaActive: z.boolean().optional(),
    })
    .strict({ message: 'Unrecognized or unauthorized fields in request body' }),
});
