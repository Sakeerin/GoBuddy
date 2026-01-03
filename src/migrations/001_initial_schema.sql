-- Initial database schema for GoBuddy
-- Run this migration to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    name VARCHAR(255),
    avatar_url TEXT,
    auth_provider VARCHAR(50) NOT NULL DEFAULT 'email',
    password_hash VARCHAR(255), -- null for OAuth users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_provider ON users(auth_provider);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'en',
    currency VARCHAR(10) DEFAULT 'THB',
    distance_unit VARCHAR(10) DEFAULT 'km' CHECK (distance_unit IN ('km', 'miles')),
    dietary_restrictions TEXT[], -- Array of strings
    mobility_constraints TEXT[], -- Array of strings
    travel_preferences JSONB DEFAULT '{"budget": "mid", "comfort": "comfortable", "adventure": "medium"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest sessions table
CREATE TABLE IF NOT EXISTS guest_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_guest_sessions_expires_at ON guest_sessions(expires_at);

-- OTP codes table (for email verification)
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_otp_codes_email ON otp_codes(email);
CREATE INDEX idx_otp_codes_code ON otp_codes(code);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    guest_session_id UUID REFERENCES guest_sessions(session_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'planning', 'booked', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_user_or_guest CHECK (
        (user_id IS NOT NULL AND guest_session_id IS NULL) OR
        (user_id IS NULL AND guest_session_id IS NOT NULL)
    )
);

CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_guest_session_id ON trips(guest_session_id);
CREATE INDEX idx_trips_status ON trips(status);

-- Trip preferences table
CREATE TABLE IF NOT EXISTS trip_preferences (
    trip_id UUID PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
    destination JSONB NOT NULL, -- {city, country, coordinates: {lat, lng}}
    dates JSONB NOT NULL, -- {start, end}
    travelers JSONB NOT NULL, -- {adults, children, seniors}
    budget JSONB NOT NULL, -- {total?, per_day?, currency}
    style VARCHAR(50) NOT NULL CHECK (style IN ('city_break', 'nature', 'theme', 'workation', 'family')),
    daily_time_window JSONB NOT NULL, -- {start: "HH:mm", end: "HH:mm"}
    constraints JSONB NOT NULL, -- {max_walking_km_per_day?, has_children, has_seniors, needs_rest_time, avoid_crowds, risk_areas_to_avoid?}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- POIs table
CREATE TABLE IF NOT EXISTS pois (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id VARCHAR(255) NOT NULL, -- External provider ID
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location JSONB NOT NULL, -- {lat, lng, address?}
    hours JSONB, -- {day: {open, close, closed?}}
    tags TEXT[] NOT NULL DEFAULT '{}',
    avg_duration_minutes INTEGER NOT NULL,
    price_range JSONB, -- {min, max, currency}
    rating DECIMAL(3,2),
    rating_count INTEGER,
    images TEXT[],
    website_url TEXT,
    phone VARCHAR(50),
    provider VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pois_place_id ON pois(place_id);
CREATE INDEX idx_pois_provider ON pois(provider);
CREATE INDEX idx_pois_tags ON pois USING GIN(tags);
CREATE INDEX idx_pois_location ON pois USING GIN(location);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trip_preferences_updated_at BEFORE UPDATE ON trip_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pois_updated_at BEFORE UPDATE ON pois
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

