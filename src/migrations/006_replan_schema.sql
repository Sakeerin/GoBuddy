-- Replan proposals table
-- Run this migration after 005_events_schema.sql

CREATE TABLE IF NOT EXISTS replan_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    trigger_id UUID REFERENCES replan_triggers(id) ON DELETE SET NULL,
    score DECIMAL(3,2) NOT NULL CHECK (score >= 0 AND score <= 1),
    explanation TEXT NOT NULL,
    changes JSONB NOT NULL, -- ProposalChanges structure
    impact JSONB NOT NULL, -- ProposalImpact structure
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_replan_proposals_trip_id ON replan_proposals(trip_id);
CREATE INDEX idx_replan_proposals_trigger_id ON replan_proposals(trigger_id);
CREATE INDEX idx_replan_proposals_score ON replan_proposals(score DESC);

-- Replan applications table (for tracking applied proposals)
CREATE TABLE IF NOT EXISTS replan_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES replan_proposals(id) ON DELETE CASCADE,
    applied_version INTEGER NOT NULL,
    rollback_available_until TIMESTAMP WITH TIME ZONE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rolled_back BOOLEAN DEFAULT FALSE,
    rolled_back_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_replan_applications_trip_id ON replan_applications(trip_id);
CREATE INDEX idx_replan_applications_proposal_id ON replan_applications(proposal_id);
CREATE INDEX idx_replan_applications_rollback_until ON replan_applications(rollback_available_until);

