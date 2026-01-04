-- Sharing and collaboration tables
-- Run this migration after previous migrations

-- Trip shares table
CREATE TABLE IF NOT EXISTS trip_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    share_token VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trip_shares_trip_id ON trip_shares(trip_id);
CREATE INDEX idx_trip_shares_token ON trip_shares(share_token);
CREATE INDEX idx_trip_shares_expires_at ON trip_shares(expires_at);

-- Share audit log
CREATE TABLE IF NOT EXISTS share_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_share_audit_log_trip_id ON share_audit_log(trip_id);
CREATE INDEX idx_share_audit_log_created_at ON share_audit_log(created_at);

-- Collaboration invites (for future use)
CREATE TABLE IF NOT EXISTS collaboration_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_collaboration_invites_trip_id ON collaboration_invites(trip_id);
CREATE INDEX idx_collaboration_invites_token ON collaboration_invites(token);
CREATE INDEX idx_collaboration_invites_email ON collaboration_invites(invited_email);

-- Votes (for future use)
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    item_id UUID, -- itinerary item or replan proposal
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(50) NOT NULL CHECK (vote_type IN ('activity', 'replan_option')),
    vote_value VARCHAR(20) NOT NULL CHECK (vote_value IN ('up', 'down', 'neutral')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trip_id, item_id, voter_id)
);

CREATE INDEX idx_votes_trip_id ON votes(trip_id);
CREATE INDEX idx_votes_item_id ON votes(item_id);

-- Comments (for future use)
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    item_id UUID, -- itinerary item or day
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_trip_id ON comments(trip_id);
CREATE INDEX idx_comments_item_id ON comments(item_id);

-- Trigger for updated_at on trip_shares
CREATE TRIGGER update_trip_shares_updated_at BEFORE UPDATE ON trip_shares
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on comments
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

