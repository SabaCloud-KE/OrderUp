-- =============================================================================
-- OrderUp Kenya Multi-Tenant SaaS Database Schema Migration
-- Standard: 3NF Normalized, UUID Primary Keys (gen_random_uuid()), Strict Tenant Isolation
-- =============================================================================

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUM TYPES
-- -----------------------------------------------------------------------------

CREATE TYPE user_role_enum AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'WAITER',
  'CUSTOMER'
);

CREATE TYPE table_status_enum AS ENUM (
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'OUT_OF_SERVICE'
);

CREATE TYPE offer_type_enum AS ENUM (
  'PERCENTAGE_DISCOUNT',
  'FIXED_AMOUNT_DISCOUNT',
  'BUY_ONE_GET_ONE'
);

CREATE TYPE order_status_enum AS ENUM (
  'PENDING',
  'CLAIMED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE payment_method_enum AS ENUM (
  'MPESA_STK',
  'CASH',
  'CARD'
);

CREATE TYPE payment_status_enum AS ENUM (
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELLED'
);

CREATE TYPE notification_type_enum AS ENUM (
  'NEW_ORDER',
  'PAYMENT_SUCCESS',
  'ORDER_CLAIMED',
  'ORDER_READY',
  'ORDER_DELIVERED',
  'OFFER_PUBLISHED',
  'WAITER_CALL',
  'SYSTEM_ALERT'
);

-- -----------------------------------------------------------------------------
-- AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. CLUBS (TENANTS)
-- -----------------------------------------------------------------------------

CREATE TYPE business_type_enum AS ENUM (
  'RESTAURANT',
  'CLUB',
  'BAR',
  'LOUNGE',
  'CAFE',
  'FAST_FOOD',
  'HOTEL',
  'FOOD_COURT',
  'OTHER'
);

CREATE TYPE business_status_enum AS ENUM (
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED'
);

CREATE TYPE subscription_status_enum AS ENUM (
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED'
);

CREATE TABLE clubs (
  club_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  business_type business_type_enum NOT NULL DEFAULT 'RESTAURANT',
  logo_url TEXT,
  banner_url TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  city VARCHAR(100) NOT NULL DEFAULT 'Nairobi',
  county VARCHAR(100) NOT NULL DEFAULT 'Nairobi',
  address TEXT,
  gps_coordinates VARCHAR(100),
  description TEXT,
  country VARCHAR(100) NOT NULL DEFAULT 'Kenya',
  currency VARCHAR(10) NOT NULL DEFAULT 'KES',
  timezone VARCHAR(100) NOT NULL DEFAULT 'Africa/Nairobi',
  brand_color VARCHAR(10) NOT NULL DEFAULT '#e11d48',
  opening_hours VARCHAR(10) NOT NULL DEFAULT '08:00',
  closing_hours VARCHAR(10) NOT NULL DEFAULT '23:00',
  operating_schedule JSONB,
  business_status business_status_enum NOT NULL DEFAULT 'ACTIVE',
  subscription_status subscription_status_enum NOT NULL DEFAULT 'ACTIVE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_clubs_slug ON clubs(slug);
CREATE INDEX idx_clubs_is_active ON clubs(is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. USERS
-- -----------------------------------------------------------------------------

CREATE TABLE users (
  user_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role user_role_enum NOT NULL DEFAULT 'WAITER',
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  email_verification_token VARCHAR(255),
  reset_password_token VARCHAR(255),
  reset_password_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_club_uuid ON users(club_uuid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. USER SESSIONS
-- -----------------------------------------------------------------------------

CREATE TABLE user_sessions (
  session_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
  club_uuid UUID REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_uuid);
CREATE INDEX idx_user_sessions_club ON user_sessions(club_uuid);

CREATE TRIGGER trg_user_sessions_updated_at
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. REFRESH TOKENS
-- -----------------------------------------------------------------------------

CREATE TABLE refresh_tokens (
  token_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uuid UUID NOT NULL REFERENCES user_sessions(session_uuid) ON DELETE CASCADE,
  user_uuid UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_session ON refresh_tokens(session_uuid);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_uuid);

-- -----------------------------------------------------------------------------
-- 5. VENUE TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE venue_tables (
  table_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  table_number INT NOT NULL,
  section_name VARCHAR(100) NOT NULL DEFAULT 'Main Floor',
  seating_capacity INT NOT NULL DEFAULT 4 CHECK (seating_capacity > 0),
  status table_status_enum NOT NULL DEFAULT 'AVAILABLE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_club_table_number UNIQUE (club_uuid, table_number)
);

CREATE INDEX idx_venue_tables_club ON venue_tables(club_uuid);
CREATE INDEX idx_venue_tables_status ON venue_tables(club_uuid, status);

CREATE TRIGGER trg_venue_tables_updated_at
  BEFORE UPDATE ON venue_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. QR CODES
-- -----------------------------------------------------------------------------

CREATE TABLE qr_codes (
  qr_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  table_uuid UUID NOT NULL UNIQUE REFERENCES venue_tables(table_uuid) ON DELETE CASCADE,
  qr_code_payload TEXT NOT NULL UNIQUE,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  scan_count INT NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_qr_codes_club ON qr_codes(club_uuid);
CREATE INDEX idx_qr_codes_table ON qr_codes(table_uuid);

CREATE TRIGGER trg_qr_codes_updated_at
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 7. CUSTOMER SESSIONS (QR Scanning Guests)
-- -----------------------------------------------------------------------------

CREATE TABLE customer_sessions (
  customer_session_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  table_uuid UUID REFERENCES venue_tables(table_uuid) ON DELETE SET NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  customer_phone VARCHAR(20),
  device_fingerprint VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_sessions_club ON customer_sessions(club_uuid);
CREATE INDEX idx_customer_sessions_table ON customer_sessions(table_uuid);

CREATE TRIGGER trg_customer_sessions_updated_at
  BEFORE UPDATE ON customer_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 8. MENU CATEGORIES
-- -----------------------------------------------------------------------------

CREATE TABLE menu_categories (
  category_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_club_category_name UNIQUE (club_uuid, name)
);

CREATE INDEX idx_menu_categories_club ON menu_categories(club_uuid);

CREATE TRIGGER trg_menu_categories_updated_at
  BEFORE UPDATE ON menu_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 9. PRODUCTS (MENU ITEMS)
-- -----------------------------------------------------------------------------

CREATE TABLE products (
  product_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  category_uuid UUID NOT NULL REFERENCES menu_categories(category_uuid) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sku VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_club_product_sku UNIQUE (club_uuid, sku)
);

CREATE INDEX idx_products_club ON products(club_uuid);
CREATE INDEX idx_products_category ON products(category_uuid);
CREATE INDEX idx_products_available ON products(club_uuid, is_available) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 10. OFFERS & DISCOUNTS
-- -----------------------------------------------------------------------------

CREATE TABLE offers (
  offer_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  offer_type offer_type_enum NOT NULL DEFAULT 'PERCENTAGE_DISCOUNT',
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  promo_code VARCHAR(50),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_offer_dates CHECK (end_time > start_time)
);

CREATE INDEX idx_offers_club ON offers(club_uuid);
CREATE INDEX idx_offers_active ON offers(club_uuid, is_active);

CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 11. ORDERS
-- -----------------------------------------------------------------------------

CREATE TABLE orders (
  order_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  table_uuid UUID REFERENCES venue_tables(table_uuid) ON DELETE SET NULL,
  waiter_uuid UUID REFERENCES users(user_uuid) ON DELETE SET NULL,
  customer_session_uuid UUID REFERENCES customer_sessions(customer_session_uuid) ON DELETE SET NULL,
  offer_uuid UUID REFERENCES offers(offer_uuid) ON DELETE SET NULL,
  order_number VARCHAR(50) NOT NULL,
  subtotal_amount NUMERIC(10, 2) NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  status order_status_enum NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  age_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_club ON orders(club_uuid);
CREATE INDEX idx_orders_table ON orders(table_uuid);
CREATE INDEX idx_orders_status ON orders(club_uuid, status);
CREATE INDEX idx_orders_created_at ON orders(club_uuid, created_at DESC);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 12. ORDER ITEMS
-- -----------------------------------------------------------------------------

CREATE TABLE order_items (
  order_item_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  order_uuid UUID NOT NULL REFERENCES orders(order_uuid) ON DELETE CASCADE,
  product_uuid UUID NOT NULL REFERENCES products(product_uuid) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_club ON order_items(club_uuid);
CREATE INDEX idx_order_items_order ON order_items(order_uuid);
CREATE INDEX idx_order_items_product ON order_items(product_uuid);

-- -----------------------------------------------------------------------------
-- 13. PAYMENTS (M-Pesa, Cash, Card)
-- -----------------------------------------------------------------------------

CREATE TABLE payments (
  payment_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  order_uuid UUID NOT NULL REFERENCES orders(order_uuid) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  payment_method payment_method_enum NOT NULL DEFAULT 'MPESA_STK',
  payment_status payment_status_enum NOT NULL DEFAULT 'PENDING',
  transaction_reference VARCHAR(100) UNIQUE,
  phone_number VARCHAR(20),
  merchant_request_id VARCHAR(100),
  checkout_request_id VARCHAR(100),
  mpesa_receipt_number VARCHAR(100),
  exact_cash BOOLEAN,
  customer_cash_amount NUMERIC(10, 2),
  change_due NUMERIC(10, 2),
  payment_notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_club ON payments(club_uuid);
CREATE INDEX idx_payments_order ON payments(order_uuid);
CREATE INDEX idx_payments_status ON payments(club_uuid, payment_status);
CREATE INDEX idx_payments_checkout_req ON payments(checkout_request_id);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 14. AUDIT LOGS
-- -----------------------------------------------------------------------------

CREATE TABLE audit_logs (
  audit_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  user_uuid UUID REFERENCES users(user_uuid) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_uuid UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_club ON audit_logs(club_uuid);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_uuid);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- -----------------------------------------------------------------------------
-- 15. NOTIFICATIONS
-- -----------------------------------------------------------------------------

CREATE TABLE notifications (
  notification_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_uuid UUID NOT NULL REFERENCES clubs(club_uuid) ON DELETE CASCADE,
  user_uuid UUID REFERENCES users(user_uuid) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type notification_type_enum NOT NULL DEFAULT 'NEW_ORDER',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_club ON notifications(club_uuid);
CREATE INDEX idx_notifications_user ON notifications(user_uuid, is_read);
