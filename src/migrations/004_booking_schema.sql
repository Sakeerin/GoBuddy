-- Booking tables schema
-- Run this migration after previous migrations

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    itinerary_item_id UUID REFERENCES itinerary_items(id) ON DELETE SET NULL,
    provider_id VARCHAR(100) NOT NULL,
    provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('activity', 'hotel', 'transport')),
    external_booking_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'canceled', 'refunded')),
    price JSONB NOT NULL, -- {amount, currency}
    policies JSONB NOT NULL, -- {cancellation, refund, cancellation_deadline?}
    voucher_url TEXT,
    voucher_data TEXT, -- Base64 encoded voucher
    confirmation_number VARCHAR(50) NOT NULL,
    traveler_details JSONB NOT NULL, -- {adults, children?, seniors?}
    booking_date DATE NOT NULL,
    booking_time VARCHAR(5), -- HH:mm format for activities
    contact_info JSONB NOT NULL, -- {email, phone?, name}
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX idx_bookings_itinerary_item_id ON bookings(itinerary_item_id);
CREATE INDEX idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_external_id ON bookings(external_booking_id);

-- Booking state history
CREATE TABLE IF NOT EXISTS booking_state_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    reason TEXT,
    changed_by VARCHAR(255), -- user_id or 'system'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_booking_state_history_booking_id ON booking_state_history(booking_id);
CREATE INDEX idx_booking_state_history_created_at ON booking_state_history(created_at);

-- Booking idempotency
CREATE TABLE IF NOT EXISTS booking_idempotency (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_booking_idempotency_booking_id ON booking_idempotency(booking_id);

-- Trigger for updated_at on bookings
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

