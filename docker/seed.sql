-- GoBuddy Demo Data Seed Script
-- This script creates dummy data for demonstration purposes
-- Note: UUID extension should already be enabled by migration 001_initial_schema.sql

-- ============================================
-- USERS & PROFILES
-- ============================================

-- Demo Users
INSERT INTO users (id, email, password_hash, auth_provider, name, avatar_url, email_verified, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo@example.com', '$2a$10$rK8X8X8X8X8X8X8X8X8Xe8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X', 'email', 'Demo User', NULL, true, NOW()),
  ('00000000-0000-0000-0000-000000000002', 'admin@example.com', '$2a$10$rK8X8X8X8X8X8X8X8X8Xe8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X', 'email', 'Admin User', NULL, true, NOW()),
  ('00000000-0000-0000-0000-000000000003', 'traveler@example.com', '$2a$10$rK8X8X8X8X8X8X8X8X8Xe8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X', 'email', 'Traveler User', NULL, true, NOW())
ON CONFLICT (id) DO NOTHING;

-- User Profiles
INSERT INTO user_profiles (user_id, language, currency, distance_unit, dietary_restrictions, mobility_constraints, travel_preferences, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'en', 'USD', 'km', ARRAY[]::TEXT[], ARRAY[]::TEXT[], '{"budget": "mid", "comfort": "standard", "adventure": "moderate"}'::JSONB, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'en', 'USD', 'km', ARRAY[]::TEXT[], ARRAY[]::TEXT[], '{"budget": "high", "comfort": "premium", "adventure": "low"}'::JSONB, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'en', 'THB', 'km', ARRAY['vegetarian']::TEXT[], ARRAY[]::TEXT[], '{"budget": "low", "comfort": "basic", "adventure": "high"}'::JSONB, NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Admin User
INSERT INTO admin_users (user_id, role, permissions, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'super_admin', ARRAY['*'], NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- TRIPS
-- ============================================

-- Demo Trips
INSERT INTO trips (id, user_id, name, destination_city, destination_country, destination_lat, destination_lng, start_date, end_date, travelers_adults, travelers_children, travelers_seniors, budget_total, budget_per_day, budget_currency, style, daily_time_window_start, daily_time_window_end, constraints, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Bangkok Adventure',
    'Bangkok',
    'Thailand',
    13.7563,
    100.5018,
    CURRENT_DATE + INTERVAL '7 days',
    CURRENT_DATE + INTERVAL '10 days',
    2,
    0,
    0,
    50000,
    12500,
    'THB',
    'city_break',
    '09:00:00',
    '22:00:00',
    '{"max_walking_km_per_day": 8, "has_children": false, "has_seniors": false, "needs_rest_time": true, "avoid_crowds": false, "risk_areas_to_avoid": []}'::JSONB,
    NOW(),
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    'Tokyo Family Trip',
    'Tokyo',
    'Japan',
    35.6762,
    139.6503,
    CURRENT_DATE + INTERVAL '14 days',
    CURRENT_DATE + INTERVAL '21 days',
    2,
    2,
    0,
    200000,
    25000,
    'JPY',
    'family',
    '08:00:00',
    '20:00:00',
    '{"max_walking_km_per_day": 5, "has_children": true, "has_seniors": false, "needs_rest_time": true, "avoid_crowds": true, "risk_areas_to_avoid": []}'::JSONB,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- POIs (Sample Points of Interest)
-- ============================================

-- Bangkok POIs
INSERT INTO pois (id, place_id, name, description, location, hours, tags, avg_duration_minutes, price_range, rating, created_at, updated_at)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'bangkok-grand-palace',
    'Grand Palace',
    'Historic royal palace complex',
    '{"lat": 13.7500, "lng": 100.4925}'::JSONB,
    '{"monday": {"open": "08:30", "close": "15:30"}, "tuesday": {"open": "08:30", "close": "15:30"}, "wednesday": {"open": "08:30", "close": "15:30"}, "thursday": {"open": "08:30", "close": "15:30"}, "friday": {"open": "08:30", "close": "15:30"}, "saturday": {"open": "08:30", "close": "15:30"}, "sunday": {"open": "08:30", "close": "15:30"}}'::JSONB,
    ARRAY['attraction', 'historical', 'cultural']::TEXT[],
    180,
    '{"min": 500, "max": 500, "currency": "THB"}'::JSONB,
    4.5,
    NOW(),
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'bangkok-wat-pho',
    'Wat Pho',
    'Temple of the Reclining Buddha',
    '{"lat": 13.7465, "lng": 100.4934}'::JSONB,
    '{"monday": {"open": "08:00", "close": "18:30"}, "tuesday": {"open": "08:00", "close": "18:30"}, "wednesday": {"open": "08:00", "close": "18:30"}, "thursday": {"open": "08:00", "close": "18:30"}, "friday": {"open": "08:00", "close": "18:30"}, "saturday": {"open": "08:00", "close": "18:30"}, "sunday": {"open": "08:00", "close": "18:30"}}'::JSONB,
    ARRAY['attraction', 'temple', 'cultural']::TEXT[],
    90,
    '{"min": 200, "max": 200, "currency": "THB"}'::JSONB,
    4.6,
    NOW(),
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'bangkok-chatuchak',
    'Chatuchak Weekend Market',
    'Large weekend market with food and shopping',
    '{"lat": 13.8000, "lng": 100.5500}'::JSONB,
    '{"saturday": {"open": "09:00", "close": "18:00"}, "sunday": {"open": "09:00", "close": "18:00"}}'::JSONB,
    ARRAY['shopping', 'market', 'food']::TEXT[],
    240,
    '{"min": 0, "max": 1000, "currency": "THB"}'::JSONB,
    4.3,
    NOW(),
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'bangkok-mahanakhon',
    'Mahanakhon Skywalk',
    'Observation deck with city views',
    '{"lat": 13.7234, "lng": 100.5300}'::JSONB,
    '{"monday": {"open": "10:00", "close": "00:00"}, "tuesday": {"open": "10:00", "close": "00:00"}, "wednesday": {"open": "10:00", "close": "00:00"}, "thursday": {"open": "10:00", "close": "00:00"}, "friday": {"open": "10:00", "close": "00:00"}, "saturday": {"open": "10:00", "close": "00:00"}, "sunday": {"open": "10:00", "close": "00:00"}}'::JSONB,
    ARRAY['attraction', 'viewpoint', 'outdoor']::TEXT[],
    60,
    '{"min": 880, "max": 880, "currency": "THB"}'::JSONB,
    4.4,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Tokyo POIs
INSERT INTO pois (id, place_id, name, description, location, hours, tags, avg_duration_minutes, price_range, rating, created_at, updated_at)
VALUES
  (
    '20000000-0000-0000-0000-000000000005',
    'tokyo-sensoji',
    'Senso-ji Temple',
    'Ancient Buddhist temple in Asakusa',
    '{"lat": 35.7148, "lng": 139.7967}'::JSONB,
    '{"monday": {"open": "06:00", "close": "17:00"}, "tuesday": {"open": "06:00", "close": "17:00"}, "wednesday": {"open": "06:00", "close": "17:00"}, "thursday": {"open": "06:00", "close": "17:00"}, "friday": {"open": "06:00", "close": "17:00"}, "saturday": {"open": "06:00", "close": "17:00"}, "sunday": {"open": "06:00", "close": "17:00"}}'::JSONB,
    ARRAY['attraction', 'temple', 'cultural', 'family']::TEXT[],
    90,
    '{"min": 0, "max": 0, "currency": "JPY"}'::JSONB,
    4.5,
    NOW(),
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    'tokyo-shibuya',
    'Shibuya Crossing',
    'Famous pedestrian scramble crossing',
    '{"lat": 35.6598, "lng": 139.7006}'::JSONB,
    '{}'::JSONB,
    ARRAY['attraction', 'landmark', 'outdoor']::TEXT[],
    30,
    '{"min": 0, "max": 0, "currency": "JPY"}'::JSONB,
    4.3,
    NOW(),
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    'tokyo-ueno-park',
    'Ueno Park',
    'Large public park with museums and zoo',
    '{"lat": 35.7142, "lng": 139.7734}'::JSONB,
    '{"monday": {"open": "05:00", "close": "23:00"}, "tuesday": {"open": "05:00", "close": "23:00"}, "wednesday": {"open": "05:00", "close": "23:00"}, "thursday": {"open": "05:00", "close": "23:00"}, "friday": {"open": "05:00", "close": "23:00"}, "saturday": {"open": "05:00", "close": "23:00"}, "sunday": {"open": "05:00", "close": "23:00"}}'::JSONB,
    ARRAY['park', 'outdoor', 'family', 'museum']::TEXT[],
    180,
    '{"min": 0, "max": 600, "currency": "JPY"}'::JSONB,
    4.4,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ITINERARIES
-- ============================================

-- Bangkok Itinerary
INSERT INTO itineraries (trip_id, version, generated_at, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 1, NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Bangkok Itinerary Items (Day 1)
INSERT INTO itinerary_items (id, trip_id, day, item_type, poi_id, name, start_time, end_time, duration_minutes, is_pinned, "order", location, cost_estimate, created_at, updated_at)
VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    1,
    'poi',
    '20000000-0000-0000-0000-000000000001',
    'Grand Palace',
    (CURRENT_DATE + INTERVAL '7 days')::DATE + TIME '09:00:00',
    (CURRENT_DATE + INTERVAL '7 days')::DATE + TIME '12:00:00',
    180,
    false,
    0,
    '{"lat": 13.7500, "lng": 100.4925}'::JSONB,
    '{"amount": 500, "currency": "THB", "confidence": "fixed"}'::JSONB,
    NOW(),
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    1,
    'poi',
    '20000000-0000-0000-0000-000000000002',
    'Wat Pho',
    (CURRENT_DATE + INTERVAL '7 days')::DATE + TIME '13:00:00',
    (CURRENT_DATE + INTERVAL '7 days')::DATE + TIME '14:30:00',
    90,
    false,
    1,
    '{"lat": 13.7465, "lng": 100.4934}'::JSONB,
    '{"amount": 200, "currency": "THB", "confidence": "fixed"}'::JSONB,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROVIDER CONFIGS
-- ============================================

-- Stub Activity Provider
INSERT INTO provider_configs (id, provider_id, provider_name, provider_type, api_credentials, webhook_config, commission_rules, retry_config, rate_limits, enabled, created_at, updated_at)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    'stub-activity',
    'Stub Activity Provider',
    'activity',
    '{"api_key": "encrypted:demo-key", "base_url": "https://stub.example.com"}'::JSONB,
    '{"endpoint_url": "http://localhost:3000/webhooks/stub-activity", "secret": "demo-webhook-secret"}'::JSONB,
    '{"rate": 10, "calculation": "percentage"}'::JSONB,
    '{"max_retries": 3, "backoff_strategy": "exponential"}'::JSONB,
    '{"requests_per_minute": 60, "requests_per_day": 10000}'::JSONB,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BOOKINGS (Sample)
-- ============================================

INSERT INTO bookings (id, trip_id, itinerary_item_id, provider_id, external_booking_id, status, price_amount, price_currency, confirmation_number, booking_date, booking_time, voucher_url, voucher_data, policies, contact_info, created_at, updated_at)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'stub-activity',
    'EXT-BOOK-001',
    'confirmed',
    500,
    'THB',
    'GB-2024-001',
    (CURRENT_DATE + INTERVAL '7 days')::DATE,
    '09:00:00',
    'https://example.com/voucher/GB-2024-001',
    NULL,
    '{"cancellation": {"allowed": true, "deadline_hours": 24}, "refund": {"allowed": true, "percentage": 80}}'::JSONB,
    '{"email": "demo@example.com", "phone": "+66123456789"}'::JSONB,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Booking State History
INSERT INTO booking_state_history (booking_id, from_status, to_status, reason, changed_by, created_at)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    NULL,
    'pending',
    'Booking created',
    'system',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '50000000-0000-0000-0000-000000000001',
    'pending',
    'confirmed',
    'Provider confirmed booking',
    'system',
    NOW() - INTERVAL '30 minutes'
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- SHARING (Sample)
-- ============================================

INSERT INTO trip_shares (id, trip_id, share_token, role, expires_at, created_by, created_at, updated_at)
VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'demo-share-token-12345',
    'viewer',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'GoBuddy Demo Data Seeded Successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Demo Users:';
  RAISE NOTICE '  - demo@example.com';
  RAISE NOTICE '  - admin@example.com (super admin)';
  RAISE NOTICE '  - traveler@example.com';
  RAISE NOTICE '';
  RAISE NOTICE 'Demo Trips:';
  RAISE NOTICE '  - Bangkok Adventure (Trip ID: 10000000-0000-0000-0000-000000000001)';
  RAISE NOTICE '  - Tokyo Family Trip (Trip ID: 10000000-0000-0000-0000-000000000002)';
  RAISE NOTICE '';
  RAISE NOTICE 'Login: Use OTP login. Request OTP via API and check application logs for code.';
  RAISE NOTICE '========================================';
END $$;
