import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { providerRegistry } from '@/services/providers/provider-registry';
import { adminService } from './admin.service';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError } from '@/utils/errors';
import { ProviderConfig } from '@/types/admin';

export class ProviderManagementService {
  /**
   * Create provider configuration
   */
  async createProvider(
    config: Omit<ProviderConfig, 'id' | 'created_at' | 'updated_at'>,
    adminId: string
  ): Promise<ProviderConfig> {
    // Encrypt API credentials
    const encryptedApiKey = adminService.encrypt(config.api_credentials.api_key);
    const encryptedApiSecret = config.api_credentials.api_secret
      ? adminService.encrypt(config.api_credentials.api_secret)
      : null;

    const providerId = uuidv4();

    await query(
      `INSERT INTO provider_configs (
        id, provider_id, provider_name, provider_type,
        api_credentials, webhook_config, commission_rules,
        retry_config, rate_limits, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        providerId,
        config.provider_id,
        config.provider_name,
        config.provider_type,
        JSON.stringify({
          api_key: encryptedApiKey,
          api_secret: encryptedApiSecret,
          base_url: config.api_credentials.base_url,
        }),
        JSON.stringify(config.webhook_config),
        JSON.stringify(config.commission_rules),
        JSON.stringify(config.retry_config),
        JSON.stringify(config.rate_limits),
        config.enabled,
      ]
    );

    // Log admin action
    await adminService.logAdminAction(
      adminId,
      'provider_created',
      'provider',
      providerId,
      { provider_name: config.provider_name }
    );

    logger.info('Provider config created', { providerId, providerName: config.provider_name });

    return await this.getProvider(providerId);
  }

  /**
   * Get provider configuration
   */
  async getProvider(providerId: string): Promise<ProviderConfig> {
    const result = await query(
      `SELECT * FROM provider_configs WHERE id = $1`,
      [providerId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Provider config', providerId);
    }

    return this.mapRowToProviderConfig(result.rows[0], false); // Don't decrypt by default
  }

  /**
   * Get provider with decrypted credentials (admin only)
   */
  async getProviderWithCredentials(providerId: string): Promise<ProviderConfig> {
    const config = await this.getProvider(providerId);
    return this.mapRowToProviderConfig(
      await query(`SELECT * FROM provider_configs WHERE id = $1`, [providerId]).then((r) => r.rows[0]),
      true // Decrypt credentials
    );
  }

  /**
   * List all providers
   */
  async listProviders(): Promise<ProviderConfig[]> {
    const result = await query(
      `SELECT * FROM provider_configs ORDER BY provider_name`
    );

    return result.rows.map((row) => this.mapRowToProviderConfig(row, false));
  }

  /**
   * Update provider configuration
   */
  async updateProvider(
    providerId: string,
    updates: Partial<ProviderConfig>,
    adminId: string
  ): Promise<ProviderConfig> {
    const existing = await this.getProvider(providerId);

    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.provider_name) {
      updateFields.push(`provider_name = $${paramIndex}`);
      values.push(updates.provider_name);
      paramIndex++;
    }

    if (updates.api_credentials) {
      const encryptedApiKey = adminService.encrypt(updates.api_credentials.api_key);
      const encryptedApiSecret = updates.api_credentials.api_secret
        ? adminService.encrypt(updates.api_credentials.api_secret)
        : null;

      updateFields.push(`api_credentials = $${paramIndex}`);
      values.push(JSON.stringify({
        api_key: encryptedApiKey,
        api_secret: encryptedApiSecret,
        base_url: updates.api_credentials.base_url,
      }));
      paramIndex++;
    }

    if (updates.webhook_config) {
      updateFields.push(`webhook_config = $${paramIndex}`);
      values.push(JSON.stringify(updates.webhook_config));
      paramIndex++;
    }

    if (updates.enabled !== undefined) {
      updateFields.push(`enabled = $${paramIndex}`);
      values.push(updates.enabled);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return existing;
    }

    values.push(providerId);
    await query(
      `UPDATE provider_configs
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}`,
      values
    );

    await adminService.logAdminAction(
      adminId,
      'provider_updated',
      'provider',
      providerId,
      { updates: Object.keys(updates) }
    );

    return await this.getProvider(providerId);
  }

  /**
   * Delete provider
   */
  async deleteProvider(providerId: string, adminId: string): Promise<void> {
    await query(
      `DELETE FROM provider_configs WHERE id = $1`,
      [providerId]
    );

    await adminService.logAdminAction(
      adminId,
      'provider_deleted',
      'provider',
      providerId
    );

    logger.info('Provider config deleted', { providerId });
  }

  /**
   * Check provider health
   */
  async checkProviderHealth(providerId: string): Promise<{
    healthy: boolean;
    latency_ms?: number;
    error?: string;
  }> {
    const config = await this.getProvider(providerId);
    const provider = providerRegistry.getProvider(config.provider_id);

    if (!provider) {
      return {
        healthy: false,
        error: 'Provider adapter not registered',
      };
    }

    try {
      const startTime = Date.now();
      const isAvailable = await provider.healthCheck();
      const latency = Date.now() - startTime;

      return {
        healthy: isAvailable,
        latency_ms: latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private mapRowToProviderConfig(row: any, decryptCredentials: boolean): ProviderConfig {
    const apiCredentials = typeof row.api_credentials === 'string'
      ? JSON.parse(row.api_credentials)
      : row.api_credentials;

    let decryptedApiKey = apiCredentials.api_key;
    let decryptedApiSecret = apiCredentials.api_secret;

    if (decryptCredentials) {
      try {
        decryptedApiKey = adminService.decrypt(apiCredentials.api_key);
        if (apiCredentials.api_secret) {
          decryptedApiSecret = adminService.decrypt(apiCredentials.api_secret);
        }
      } catch (error) {
        logger.warn('Failed to decrypt credentials', { error });
      }
    } else {
      // Mask credentials
      decryptedApiKey = '***';
      decryptedApiSecret = undefined;
    }

    return {
      id: row.id,
      provider_id: row.provider_id,
      provider_name: row.provider_name,
      provider_type: row.provider_type,
      api_credentials: {
        api_key: decryptedApiKey,
        api_secret: decryptedApiSecret,
        base_url: apiCredentials.base_url,
      },
      webhook_config: typeof row.webhook_config === 'string'
        ? JSON.parse(row.webhook_config)
        : row.webhook_config,
      commission_rules: typeof row.commission_rules === 'string'
        ? JSON.parse(row.commission_rules)
        : row.commission_rules,
      retry_config: typeof row.retry_config === 'string'
        ? JSON.parse(row.retry_config)
        : row.retry_config,
      rate_limits: typeof row.rate_limits === 'string'
        ? JSON.parse(row.rate_limits)
        : row.rate_limits,
      enabled: row.enabled,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const providerManagementService = new ProviderManagementService();
