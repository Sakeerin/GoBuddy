import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import { WebhookLog } from '@/types/admin';

export class WebhookLogService {
  /**
   * Log webhook event
   */
  async logWebhook(
    providerId: string,
    eventType: string,
    payload: unknown,
    status: 'success' | 'failed' | 'pending' = 'pending'
  ): Promise<WebhookLog> {
    const logId = uuidv4();

    await query(
      `INSERT INTO webhook_logs (
        id, provider_id, event_type, payload, status, retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        logId,
        providerId,
        eventType,
        JSON.stringify(payload),
        status,
        0,
      ]
    );

    return await this.getWebhookLog(logId);
  }

  /**
   * Update webhook log status
   */
  async updateWebhookStatus(
    logId: string,
    status: 'success' | 'failed',
    responseCode?: number,
    responseBody?: string,
    errorMessage?: string
  ): Promise<void> {
    await query(
      `UPDATE webhook_logs
       SET status = $1, response_code = $2, response_body = $3,
           error_message = $4, processed_at = NOW()
       WHERE id = $5`,
      [status, responseCode || null, responseBody || null, errorMessage || null, logId]
    );
  }

  /**
   * Get webhook log
   */
  async getWebhookLog(logId: string): Promise<WebhookLog> {
    const result = await query(
      `SELECT * FROM webhook_logs WHERE id = $1`,
      [logId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Webhook log', logId);
    }

    return this.mapRowToWebhookLog(result.rows[0]);
  }

  /**
   * List webhook logs
   */
  async listWebhookLogs(
    providerId?: string,
    status?: 'success' | 'failed' | 'pending',
    limit: number = 100
  ): Promise<WebhookLog[]> {
    let queryText = 'SELECT * FROM webhook_logs WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (providerId) {
      queryText += ` AND provider_id = $${paramIndex}`;
      params.push(providerId);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query(queryText, params);
    return result.rows.map((row) => this.mapRowToWebhookLog(row));
  }

  /**
   * Retry failed webhook
   */
  async retryWebhook(logId: string): Promise<WebhookLog> {
    const log = await this.getWebhookLog(logId);

    if (log.status !== 'failed') {
      throw new ValidationError('Can only retry failed webhooks');
    }

    // Increment retry count
    await query(
      `UPDATE webhook_logs
       SET retry_count = retry_count + 1, status = 'pending', processed_at = NULL
       WHERE id = $1`,
      [logId]
    );

    logger.info('Webhook retry initiated', { logId, providerId: log.provider_id });

    return await this.getWebhookLog(logId);
  }

  private mapRowToWebhookLog(row: any): WebhookLog {
    return {
      id: row.id,
      provider_id: row.provider_id,
      event_type: row.event_type,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      status: row.status,
      response_code: row.response_code,
      response_body: row.response_body,
      error_message: row.error_message,
      retry_count: row.retry_count,
      created_at: row.created_at,
      processed_at: row.processed_at,
    };
  }
}

export const webhookLogService = new WebhookLogService();
