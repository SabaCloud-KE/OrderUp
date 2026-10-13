-- =============================================================================
-- OrderUp Kenya Seed Data
-- Demo Venues: The Alchemist (Westlands), B-Club (Kilimani)
-- =============================================================================

-- 1. SEED CLUBS (TENANTS)
INSERT INTO clubs (club_uuid, name, slug, business_type, logo_url, phone, email, city, address) VALUES
('11111111-1111-1111-1111-111111111111', 'The Alchemist Westlands', 'alchemist-westlands', 'LOUNGE', 'https://orderup.co.ke/logos/alchemist.png', '+254712345678', 'info@alchemist.co.ke', 'Nairobi', 'Parklands Road, Westlands'),
('22222222-2222-2222-2222-222222222222', 'B-Club Kilimani', 'bclub-kilimani', 'CLUB', 'https://orderup.co.ke/logos/bclub.png', '+254722998877', 'vip@bclub.co.ke', 'Nairobi', 'Galana Plaza, Kilimani')
ON CONFLICT (club_uuid) DO UPDATE SET
  name = EXCLUDED.name,
  business_type = EXCLUDED.business_type,
  slug = EXCLUDED.slug;

-- 2. SEED USERS (Platform Admins, Club Admins, Managers, Waiters)
-- Password Hash corresponds to 'Password123!' hashed with bcrypt (cost factor 12)
-- Hash verified: bcrypt.compare('Password123!', hash) === true
INSERT INTO users (user_uuid, club_uuid, email, password_hash, full_name, phone, role) VALUES
('00000000-0000-0000-0000-000000000001', NULL, 'superadmin@orderup.co.ke', '$2b$12$h2/AMEDIxKjdwx6YNdjzgeWV/.JfQ6/pVMEW2Fc2Q2g4U57gcm9Em', 'Super Admin', '+254700000000', 'SUPER_ADMIN'),
('11111111-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'admin@alchemist.co.ke', '$2b$12$h2/AMEDIxKjdwx6YNdjzgeWV/.JfQ6/pVMEW2Fc2Q2g4U57gcm9Em', 'John Alchemist Admin', '+254711111111', 'ADMIN'),
('11111111-1111-1111-1111-000000000002', '11111111-1111-1111-1111-111111111111', 'manager@alchemist.co.ke', '$2b$12$h2/AMEDIxKjdwx6YNdjzgeWV/.JfQ6/pVMEW2Fc2Q2g4U57gcm9Em', 'Alex Alchemist Manager', '+254711222333', 'MANAGER'),
('11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-111111111111', 'waiter.kamau@alchemist.co.ke', '$2b$12$h2/AMEDIxKjdwx6YNdjzgeWV/.JfQ6/pVMEW2Fc2Q2g4U57gcm9Em', 'Kamau Njoroge', '+254711223344', 'WAITER'),
('22222222-2222-2222-2222-000000000001', '22222222-2222-2222-2222-222222222222', 'admin@bclub.co.ke', '$2b$12$h2/AMEDIxKjdwx6YNdjzgeWV/.JfQ6/pVMEW2Fc2Q2g4U57gcm9Em', 'Sarah B-Club Manager', '+254722000111', 'ADMIN')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = true;

-- 3. SEED VENUE TABLES
INSERT INTO venue_tables (table_uuid, club_uuid, table_number, section_name, seating_capacity, status) VALUES
('11111111-0001-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 'Main Courtyard', 4, 'AVAILABLE'),
('11111111-0002-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 2, 'Main Courtyard', 6, 'OCCUPIED'),
('11111111-0003-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 10, 'VIP Lounge', 8, 'RESERVED'),
('22222222-0001-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 1, 'VIP Terrace', 6, 'AVAILABLE')
ON CONFLICT (club_uuid, table_number) DO UPDATE SET
  status = EXCLUDED.status,
  section_name = EXCLUDED.section_name;

-- 4. SEED QR CODES
INSERT INTO qr_codes (qr_uuid, club_uuid, table_uuid, qr_code_payload, image_url, scan_count) VALUES
('11111111-0001-0000-0001-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-0001-0000-0000-000000000001', 'https://orderup.co.ke/v/alchemist-westlands/t/1', 'https://orderup.co.ke/qr/alc_t1.png', 42),
('11111111-0002-0000-0001-000000000002', '11111111-1111-1111-1111-111111111111', '11111111-0002-0000-0000-000000000002', 'https://orderup.co.ke/v/alchemist-westlands/t/2', 'https://orderup.co.ke/qr/alc_t2.png', 108)
ON CONFLICT (table_uuid) DO NOTHING;

-- 5. SEED MENU CATEGORIES
INSERT INTO menu_categories (category_uuid, club_uuid, name, description, display_order) VALUES
('11111111-0001-0000-0002-000000000001', '11111111-1111-1111-1111-111111111111', 'Local & Craft Beers', 'Cold Kenyan lager and craft beers', 1),
('11111111-0002-0000-0002-000000000002', '11111111-1111-1111-1111-111111111111', 'Cocktails & Mixers', 'Signature African infused cocktails', 2),
('11111111-0003-0000-0002-000000000003', '11111111-1111-1111-1111-111111111111', 'Bitings & Grill', 'Nyama Choma and bar snacks', 3)
ON CONFLICT (club_uuid, name) DO NOTHING;

-- 6. SEED PRODUCTS (MENU ITEMS)
INSERT INTO products (product_uuid, club_uuid, category_uuid, name, description, price, sku, is_available) VALUES
('11111111-0001-0000-0003-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-0001-0000-0002-000000000001', 'Tusker Lager (500ml)', 'Kenya finest ice cold lager', 350.00, 'TUSK-500', true),
('11111111-0002-0000-0003-000000000002', '11111111-1111-1111-1111-111111111111', '11111111-0001-0000-0002-000000000001', 'White Cap Crisp (500ml)', 'Sugar-free crisp lager', 380.00, 'WCAP-500', true),
('11111111-0003-0000-0003-000000000003', '11111111-1111-1111-1111-111111111111', '11111111-0002-0000-0002-000000000002', 'Nairobi Dawa Cocktail', 'Vodka, honey, lime & ginger stem', 750.00, 'DAWA-01', true),
('11111111-0004-0000-0003-000000000004', '11111111-1111-1111-1111-111111111111', '11111111-0003-0000-0002-000000000003', 'Nyama Choma Platter (1kg)', 'Grilled goat meat served with Kachumbari', 1800.00, 'CHOMA-1KG', true)
ON CONFLICT (club_uuid, sku) DO NOTHING;

-- 7. SEED OFFERS
INSERT INTO offers (offer_uuid, club_uuid, title, description, offer_type, discount_value, promo_code, start_time, end_time) VALUES
('11111111-0001-0000-0004-000000000001', '11111111-1111-1111-1111-111111111111', 'Happy Hour Beer Bucket', '15% off all Kenyan beers on Happy Hour', 'PERCENTAGE_DISCOUNT', 15.00, 'HAPPYBEER', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days')
ON CONFLICT (offer_uuid) DO NOTHING;

-- 8. SEED CUSTOMER SESSION
INSERT INTO customer_sessions (customer_session_uuid, club_uuid, table_uuid, session_token, customer_phone, expires_at) VALUES
('11111111-0001-0000-0005-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-0002-0000-0000-000000000002', 'sess_token_abc123xyz', '+254799887766', CURRENT_TIMESTAMP + INTERVAL '6 hours')
ON CONFLICT (session_token) DO NOTHING;

-- 9. SEED ORDERS & ORDER ITEMS
INSERT INTO orders (order_uuid, club_uuid, table_uuid, waiter_uuid, customer_session_uuid, order_number, subtotal_amount, discount_amount, total_amount, status, notes) VALUES
('11111111-0001-0000-0006-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-0002-0000-0000-000000000002', '11111111-1111-1111-1111-000000000003', '11111111-0001-0000-0005-000000000001', 'ORD-1001', 2500.00, 0.00, 2500.00, 'PREPARING', 'Extra kachumbari with the Nyama Choma')
ON CONFLICT (order_uuid) DO NOTHING;

INSERT INTO order_items (order_item_uuid, club_uuid, order_uuid, product_uuid, quantity, unit_price, subtotal) VALUES
('11111111-0001-0000-0007-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-0001-0000-0006-000000000001', '11111111-0001-0000-0003-000000000001', 2, 350.00, 700.00),
('11111111-0002-0000-0007-000000000002', '11111111-1111-1111-1111-111111111111', '11111111-0001-0000-0006-000000000001', '11111111-0004-0000-0003-000000000004', 1, 1800.00, 1800.00)
ON CONFLICT (order_item_uuid) DO NOTHING;

-- 10. SEED PAYMENTS (M-Pesa STK Push)
INSERT INTO payments (payment_uuid, club_uuid, order_uuid, amount, payment_method, payment_status, transaction_reference, phone_number, checkout_request_id, mpesa_receipt_number, paid_at) VALUES
('11111111-0001-0000-0008-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-0001-0000-0006-000000000001', 2500.00, 'MPESA_STK', 'PAID', 'MPESA_TXN_SHG89921', '+254799887766', 'ws_CO_04082026150000111', 'RGA7882910', CURRENT_TIMESTAMP)
ON CONFLICT (payment_uuid) DO NOTHING;

-- 11. SEED AUDIT LOGS
INSERT INTO audit_logs (audit_uuid, club_uuid, user_uuid, action, entity_type, entity_uuid, new_values) VALUES
('11111111-0001-0000-0009-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-000000000001', 'CREATE_ORDER', 'ORDER', '11111111-0001-0000-0006-000000000001', '{"order_number": "ORD-1001", "total": 2500}')
ON CONFLICT (audit_uuid) DO NOTHING;

-- 12. SEED NOTIFICATIONS
INSERT INTO notifications (notification_uuid, club_uuid, user_uuid, title, message, type) VALUES
('11111111-0001-0000-000a-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-000000000003', 'New Order #ORD-1001', 'Table 2 has placed a new order for KES 2,500.00', 'NEW_ORDER')
ON CONFLICT (notification_uuid) DO NOTHING;
