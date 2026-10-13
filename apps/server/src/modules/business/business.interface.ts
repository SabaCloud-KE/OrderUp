/**
 * Business Profile & Settings Module — Interfaces & DTOs
 *
 * All operations derive business scope server-side from the authenticated ADMIN's live DB record.
 * Client-provided business identifiers are strictly prohibited.
 */

import { BusinessType } from '@orderup/shared';

export interface DayOperatingHours {
  isOpen: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
  crossesMidnight?: boolean;
}

export interface WeeklyOperatingSchedule {
  monday: DayOperatingHours;
  tuesday: DayOperatingHours;
  wednesday: DayOperatingHours;
  thursday: DayOperatingHours;
  friday: DayOperatingHours;
  saturday: DayOperatingHours;
  sunday: DayOperatingHours;
}

export interface BusinessProfileDTO {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType | string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string;
  county: string;
  country: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  themeColor: string;
  timezone: string;
  currency: string;
  openingHours: string;
  closingHours: string;
  operatingSchedule: WeeklyOperatingSchedule | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBusinessProfileInput {
  name?: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string;
  county?: string;
  country?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  themeColor?: string;
}

export interface UpdateBusinessSettingsInput {
  timezone?: string;
  currency?: string;
  themeColor?: string;
  operatingSchedule?: WeeklyOperatingSchedule;
  openingHours?: string;
  closingHours?: string;
}
