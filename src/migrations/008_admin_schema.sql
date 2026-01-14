-- Admin and observability tables
-- Run this migration after previous migrations

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'support')),
    permissions TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_role ON admin_users(role);

-- Provider configs table
CREATE TABLE IF NOT EXISTS provider_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id VARCHAR(100) UNIQUE NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('activity', 'hotel', 'transport')),
    api_credentials JSONB NOT NULL, -- Encrypted credentials
    webhook_config JSONB NOT NULL,
    commission_rules JSONB NOT NULL,
    retry_config JSONB NOT NULL,
    rate_limits JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_provider_configs_provider_id ON provider_configs(provider_id);
CREATE INDEX idx_provider_configs_enabled ON provider_configs(enabled);

-- Webhook logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('success', 'failed', 'pending')),
    response_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_webhook_logs_provider_id ON webhook_logs(provider_id);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- Trigger for updated_at on admin_users
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on provider_configs
CREATE TRIGGER update_provider_configs_updated_at BEFORE UPDATE ON provider_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
