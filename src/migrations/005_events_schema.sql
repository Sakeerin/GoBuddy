-- Event monitoring tables schema
-- Run this migration after previous migrations

-- Event signals table
CREATE TABLE IF NOT EXISTS event_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('weather', 'closure', 'sold_out', 'delay', 'availability_changed')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    location JSONB NOT NULL, -- {lat, lng, address?}
    time_slot JSONB NOT NULL, -- {start, end} ISO datetime strings
    details JSONB NOT NULL, -- Event-specific details
    affected_items TEXT[] NOT NULL DEFAULT '{}', -- itinerary item IDs
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    replan_triggered BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_event_signals_trip_id ON event_signals(trip_id);
CREATE INDEX idx_event_signals_event_type ON event_signals(event_type);
CREATE INDEX idx_event_signals_severity ON event_signals(severity);
CREATE INDEX idx_event_signals_processed ON event_signals(processed);
CREATE INDEX idx_event_signals_detected_at ON event_signals(detected_at);

-- Replan triggers table
CREATE TABLE IF NOT EXISTS replan_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    event_signal_id UUID REFERENCES event_signals(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_replan_triggers_trip_id ON replan_triggers(trip_id);
CREATE INDEX idx_replan_triggers_processed ON replan_triggers(processed);
CREATE INDEX idx_replan_triggers_priority ON replan_triggers(priority, created_at);

