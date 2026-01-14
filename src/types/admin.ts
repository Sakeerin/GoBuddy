// Admin types

export type AdminRole = 'super_admin' | 'admin' | 'support';

export interface AdminUser {
  id: string;
  user_id: string; // Reference to users table
  role: AdminRole;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

export interface ProviderConfig {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_type: 'activity' | 'hotel' | 'transport';
  api_credentials: {
    api_key: string; // Encrypted
    api_secret?: string; // Encrypted
    base_url: string;
  };
  webhook_config: {
    endpoint_url: string;
    secret: string;
  };
  commission_rules: {
    rate: number;
    calculation: 'percentage' | 'fixed';
  };
  retry_config: {
    max_retries: number;
    backoff_strategy: 'exponential' | 'linear';
  };
  rate_limits: {
    requests_per_minute: number;
    requests_per_day: number;
  };
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookLog {
  id: string;
  provider_id: string;
  event_type: string;
  payload: unknown;
  status: 'success' | 'failed' | 'pending';
  response_code?: number;
  response_body?: string;
  error_message?: string;
  retry_count: number;
  created_at: Date;
  processed_at?: Date;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  created_at: Date;
}
