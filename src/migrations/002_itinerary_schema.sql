-- Itinerary tables schema
-- Run this migration after 001_initial_schema.sql

-- Itineraries table (metadata)
CREATE TABLE IF NOT EXISTS itineraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID UNIQUE NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_itineraries_trip_id ON itineraries(trip_id);
CREATE INDEX idx_itineraries_version ON itineraries(version);

-- Itinerary items table
CREATE TABLE IF NOT EXISTS itinerary_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('poi', 'activity', 'hotel', 'transport', 'meal', 'free_time')),
    poi_id UUID REFERENCES pois(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location JSONB, -- {lat, lng, address?}
    start_time VARCHAR(5) NOT NULL, -- HH:mm format
    end_time VARCHAR(5) NOT NULL, -- HH:mm format
    duration_minutes INTEGER NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    "order" INTEGER NOT NULL, -- Order within the day
    route_from_previous JSONB, -- RouteSegment
    cost_estimate JSONB, -- {amount, currency, confidence}
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_itinerary_items_trip_id ON itinerary_items(trip_id);
CREATE INDEX idx_itinerary_items_day ON itinerary_items(trip_id, day);
CREATE INDEX idx_itinerary_items_pinned ON itinerary_items(trip_id, is_pinned);
CREATE INDEX idx_itinerary_items_order ON itinerary_items(trip_id, day, "order");

-- Trigger for updated_at on itineraries
CREATE TRIGGER update_itineraries_updated_at BEFORE UPDATE ON itineraries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on itinerary_items
CREATE TRIGGER update_itinerary_items_updated_at BEFORE UPDATE ON itinerary_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

