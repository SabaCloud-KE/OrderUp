import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default(process.env.PORT || '5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:3002,*'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('postgresql://postgres:postgres@localhost:5432/orderup_dev?sslmode=disable'),
  JWT_ACCESS_SECRET: z.string().default(process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'dev_access_secret_must_be_32_bytes_long'),
  JWT_REFRESH_SECRET: z.string().default(process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_must_be_32_bytes_long'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('8h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  MPESA_ENVIRONMENT: z.enum(['sandbox', 'production']).default(
    ((process.env.MPESA_ENVIRONMENT || process.env.MPESA_ENV || '').toLowerCase() === 'production'
      ? 'production'
      : (process.env.MPESA_ENVIRONMENT || process.env.MPESA_ENV || '').toLowerCase() === 'sandbox'
      ? 'sandbox'
      : (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox')) as 'sandbox' | 'production'
  ),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_TRANSACTION_TYPE: z.enum(['CustomerPayBillOnline', 'CustomerBuyGoodsOnline']).default(
    (process.env.MPESA_TRANSACTION_TYPE as 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline') || 'CustomerPayBillOnline'
  ),
  MPESA_CALLBACK_URL: z.string().default(
    process.env.MPESA_CALLBACK_URL || process.env.MPESA_CALLBACK_URI || ''
  ),
  CUSTOMER_PWA_URL: z.string().default(
    process.env.CUSTOMER_PWA_URL || 'https://orderup-customer.vercel.app'
  ),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default(process.env.EMAIL_FROM || 'OrderUp <devops@sabacloud.co.ke>'),
  STAFF_PORTAL_URL: z.string().default(process.env.STAFF_PORTAL_URL || 'https://order-up-staffportal.vercel.app'),
  ADMIN_PORTAL_URL: z.string().default(process.env.ADMIN_PORTAL_URL || 'https://orderup-admin.vercel.app'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
