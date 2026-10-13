import { prisma } from "./prisma";
import { logger } from "./logger";
import bcrypt from "bcrypt";

export async function autoMigrateDatabase(): Promise<void> {
  try {
    logger.info("🔄 Running database auto-migration and schema synchronization...");

    // 1. Ensure required PostgreSQL extensions
    try {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    } catch {
      // Ignored if permissions are restricted
    }

    // 2. Ensure enum types
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_type_enum') THEN
            CREATE TYPE business_type_enum AS ENUM ('RESTAURANT', 'CLUB', 'BAR', 'LOUNGE', 'CAFE', 'FAST_FOOD', 'HOTEL', 'FOOD_COURT', 'OTHER');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_status_enum') THEN
            CREATE TYPE business_status_enum AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
            CREATE TYPE subscription_status_enum AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
            CREATE TYPE user_role_enum AS ENUM ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN', 'CLUB_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'WAITER', 'CUSTOMER');
          END IF;
        END $$;
      `);
    } catch (err: any) {
      logger.warn(`Enum creation warning: ${err.message}`);
    }

    // 3. Ensure all values on user_role_enum
    const roleValues = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN', 'CLUB_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'WAITER', 'CUSTOMER'];
    for (const val of roleValues) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS '${val}';`);
      } catch {
        // Ignored if already exists
      }
    }

    // 4. Ensure clubs table and all columns
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS clubs (
          club_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) NOT NULL UNIQUE,
          created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
        );
      `);
    } catch (err: any) {
      logger.warn(`Clubs table creation warning: ${err.message}`);
    }

    const clubsColumns = [
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS business_type business_type_enum NOT NULL DEFAULT 'RESTAURANT';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS logo_url TEXT;`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS banner_url TEXT;`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS brand_color VARCHAR(50) DEFAULT '#e11d48';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS phone VARCHAR(20);`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS email VARCHAR(255);`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Nairobi';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS county VARCHAR(100) DEFAULT 'Nairobi';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS address TEXT;`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS gps_coordinates VARCHAR(100);`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS description TEXT;`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Kenya';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'KES';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Nairobi';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS opening_hours VARCHAR(10) DEFAULT '08:00';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS closing_hours VARCHAR(10) DEFAULT '23:00';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS operating_schedule JSONB;`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS business_status business_status_enum NOT NULL DEFAULT 'ACTIVE';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS subscription_status subscription_status_enum NOT NULL DEFAULT 'ACTIVE';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS mpesa_shortcode VARCHAR(20);`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS mpesa_passkey TEXT;`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS mpesa_transaction_type VARCHAR(50) DEFAULT 'CustomerPayBillOnline';`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_mpesa_active BOOLEAN DEFAULT false;`,
      `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ(6);`,
    ];

    for (const colQuery of clubsColumns) {
      try {
        await prisma.$executeRawUnsafe(colQuery);
      } catch (err: any) {
        logger.warn(`Column ensure query warning: ${err.message}`);
      }
    }

    // 5. Ensure user_sessions and refresh_tokens tables
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          session_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
          club_uuid UUID REFERENCES clubs(club_uuid) ON DELETE CASCADE,
          ip_address TEXT,
          user_agent TEXT,
          is_valid BOOLEAN NOT NULL DEFAULT true,
          expires_at TIMESTAMPTZ(6) NOT NULL,
          created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
        );
      `);
    } catch (err: any) {
      logger.warn(`user_sessions table creation warning: ${err.message}`);
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          token_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_uuid UUID NOT NULL REFERENCES user_sessions(session_uuid) ON DELETE CASCADE,
          user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          is_revoked BOOLEAN NOT NULL DEFAULT false,
          expires_at TIMESTAMPTZ(6) NOT NULL,
          created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
        );
      `);
    } catch (err: any) {
      logger.warn(`refresh_tokens table creation warning: ${err.message}`);
    }

    // 6. Ensure payments table columns and indexes
    const paymentColumns = [
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS exact_cash BOOLEAN;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_cash_amount NUMERIC(10, 2);`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS change_due NUMERIC(10, 2);`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_notes TEXT;`,
      `UPDATE payments SET paid_at = COALESCE(updated_at, created_at) WHERE payment_status = 'PAID' AND paid_at IS NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_payments_biz_status_paid_at ON payments(club_uuid, payment_status, paid_at);`,
    ];

    for (const pQuery of paymentColumns) {
      try {
        await prisma.$executeRawUnsafe(pQuery);
      } catch (err: any) {
        logger.warn(`Payment schema ensure query warning: ${err.message}`);
      }
    }

    // 7. Ensure orders table columns and indexes
    const orderQueries = [
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;`,
      `CREATE INDEX IF NOT EXISTS idx_orders_biz_created_at ON orders(club_uuid, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_biz_status ON orders(club_uuid, status);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_biz_waiter ON orders(club_uuid, waiter_uuid);`,
    ];

    for (const oQuery of orderQueries) {
      try {
        await prisma.$executeRawUnsafe(oQuery);
      } catch (err: any) {
        logger.warn(`Order schema ensure query warning: ${err.message}`);
      }
    }

    // 8. Ensure order_items indexes
    const itemQueries = [
      `CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_uuid);`,
      `CREATE INDEX IF NOT EXISTS idx_order_items_biz_product ON order_items(club_uuid, product_uuid);`,
    ];

    for (const iQuery of itemQueries) {
      try {
        await prisma.$executeRawUnsafe(iQuery);
      } catch (err: any) {
        logger.warn(`OrderItem index query warning: ${err.message}`);
      }
    }

    // 9. Ensure users table columns and indexes
    const userQueries = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMPTZ(6);`,
      `CREATE INDEX IF NOT EXISTS idx_users_biz_role_active_del ON users(club_uuid, role, is_active, deleted_at);`,
      `CREATE INDEX IF NOT EXISTS idx_users_biz_role_del ON users(club_uuid, role, deleted_at);`,
    ];

    for (const uQuery of userQueries) {
      try {
        await prisma.$executeRawUnsafe(uQuery);
      } catch (err: any) {
        logger.warn(`User schema ensure query warning: ${err.message}`);
      }
    }

    // 10. Ensure offers table columns
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE offers ADD COLUMN IF NOT EXISTS promo_code VARCHAR(100);`);
    } catch (err: any) {
      logger.warn(`Offers promo_code query warning: ${err.message}`);
    }

    // 11. Migrate legacy roles to current standard
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE users SET role = 'SUPER_ADMIN' WHERE role::text = 'PLATFORM_ADMIN';
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE users SET role = 'ADMIN' WHERE role::text IN ('CLUB_ADMIN', 'TENANT_ADMIN');
      `);
    } catch {
      // Ignored if table or values are not ready yet
    }

    // 12. Ensure default Super Administrator exists & migrate legacy DrinkHub admin
    try {
      // Step A: Migrate legacy email if exists
      await prisma.$executeRawUnsafe(`
        UPDATE users
        SET email = 'superadmin@orderup.co.ke', updated_at = NOW()
        WHERE LOWER(email) = 'superadmin@drinkhub.co.ke'
          AND NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = 'superadmin@orderup.co.ke');
      `);

      // Step B: Check if superadmin exists
      const existingSuperAdmin = await prisma.user.findFirst({
        where: {
          email: { equals: 'superadmin@orderup.co.ke', mode: 'insensitive' },
          deletedAt: null,
        },
      });

      const superAdminPasswordHash = await bcrypt.hash('Password123!', 12);

      if (!existingSuperAdmin) {
        await prisma.user.create({
          data: {
            userUuid: '00000000-0000-0000-0000-000000000001',
            email: 'superadmin@orderup.co.ke',
            passwordHash: superAdminPasswordHash,
            fullName: 'Super Administrator',
            phone: '+254700000000',
            role: 'SUPER_ADMIN' as any,
            isActive: true,
          },
        });
        logger.info('👤 Auto-provisioned default Super Administrator: superadmin@orderup.co.ke');
      } else {
        // Ensure superadmin has active status, SUPER_ADMIN role, and auto-healed Password123! hash
        await prisma.user.update({
          where: { userUuid: existingSuperAdmin.userUuid },
          data: {
            role: 'SUPER_ADMIN' as any,
            isActive: true,
            passwordHash: superAdminPasswordHash,
          },
        });
        logger.info('👤 Verified & updated Super Administrator credentials');
      }
    } catch (err: any) {
      logger.warn(`Superadmin auto-provision warning: ${err.message}`);
    }

    // 7. Auto-heal any legacy QR code URLs in qr_codes table
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE qr_codes 
        SET qr_code_payload = REPLACE(qr_code_payload, 'drink-hub-ke-customer-pwa.vercel.app', 'orderup-customer.vercel.app'),
            image_url = REPLACE(image_url, 'drink-hub-ke-customer-pwa.vercel.app', 'orderup-customer.vercel.app')
        WHERE qr_code_payload LIKE '%drink-hub-ke-customer-pwa.vercel.app%';
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE qr_codes 
        SET qr_code_payload = REPLACE(qr_code_payload, 'orderup-ke-customer-pwa.vercel.app', 'orderup-customer.vercel.app'),
            image_url = REPLACE(image_url, 'orderup-ke-customer-pwa.vercel.app', 'orderup-customer.vercel.app')
        WHERE qr_code_payload LIKE '%orderup-ke-customer-pwa.vercel.app%';
      `);
      logger.info('📱 Verified & auto-healed QR code URLs to orderup-customer.vercel.app');
    } catch (err: any) {
      logger.warn(`QR code URL auto-heal warning: ${err.message}`);
    }

    logger.info("✅ Database auto-migration completed successfully");
  } catch (error: any) {
    logger.error(`❌ Database auto-migration failed: ${error.message}`);
  }
}
