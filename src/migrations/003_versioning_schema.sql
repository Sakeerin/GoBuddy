-- Itinerary versioning tables
-- Run this migration after 002_itinerary_schema.sql

-- Itinerary versions table
CREATE TABLE IF NOT EXISTS itinerary_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('generate', 'edit', 'reorder', 'add', 'remove', 'pin', 'unpin', 'time_change')),
    changed_by VARCHAR(255), -- user_id or guest_session_id
    snapshot JSONB NOT NULL, -- Full itinerary snapshot
    diff JSONB, -- Diff from previous version
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_itinerary_versions_trip_id ON itinerary_versions(trip_id);
CREATE INDEX idx_itinerary_versions_version ON itinerary_versions(trip_id, version);
CREATE INDEX idx_itinerary_versions_created_at ON itinerary_versions(created_at);

