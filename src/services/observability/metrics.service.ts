import { query, getPoolStats } from '@/config/database';
import { logger } from '@/utils/logger';

export interface SystemMetrics {
  bookings: {
    total: number;
    success_rate: number;
    by_status: Record<string, number>;
    average_processing_time_ms: number;
  };
  providers: {
    total: number;
    healthy: number;
    average_latency_ms: number;
  };
  replan: {
    total_triggers: number;
    proposals_generated: number;
    applications_successful: number;
  };
  api: {
    total_requests: number;
    average_response_time_ms: number;
    error_rate: number;
  };
  system: {
    uptime_seconds: number;
    memory_usage_mb: number;
    database_connections: number;
  };
}

export class MetricsService {
  private startTime = Date.now();
  private requestCount = 0;
  private totalResponseTime = 0;
  private errorCount = 0;

  /**
   * Record API request
   */
  recordRequest(responseTimeMs: number, isError: boolean = false): void {
    this.requestCount++;
    this.totalResponseTime += responseTimeMs;
    if (isError) {
      this.errorCount++;
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    // Booking metrics
    const bookingMetrics = await this.getBookingMetrics();

    // Provider metrics
    const providerMetrics = await this.getProviderMetrics();

    // Replan metrics
    const replanMetrics = await this.getReplanMetrics();

    // API metrics
    const apiMetrics = this.getApiMetrics();

    // System metrics
    const systemMetrics = this.getSystemMetrics();

    return {
      bookings: bookingMetrics,
      providers: providerMetrics,
      replan: replanMetrics,
      api: apiMetrics,
      system: systemMetrics,
    };
  }

  /**
   * Get booking metrics
   */
  private async getBookingMetrics(): Promise<SystemMetrics['bookings']> {
    const result = await query(
      `SELECT
        COUNT(*) as total,
        status,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_time
      FROM bookings
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status`
    );

    const byStatus: Record<string, number> = {};
    let total = 0;
    let confirmed = 0;
    let totalTime = 0;

    for (const row of result.rows) {
      const count = parseInt(row.total, 10);
      total += count;
      byStatus[row.status] = count;
      if (row.status === 'confirmed') {
        confirmed += count;
      }
      if (row.avg_time) {
        totalTime += parseFloat(row.avg_time);
      }
    }

    return {
      total,
      success_rate: total > 0 ? (confirmed / total) * 100 : 0,
      by_status: byStatus,
      average_processing_time_ms: totalTime / result.rows.length || 0,
    };
  }

  /**
   * Get provider metrics
   */
  private async getProviderMetrics(): Promise<SystemMetrics['providers']> {
    const result = await query(
      `SELECT COUNT(*) as total FROM provider_configs WHERE enabled = TRUE`
    );

    // TODO: Check actual provider health
    return {
      total: parseInt(result.rows[0].total, 10),
      healthy: parseInt(result.rows[0].total, 10), // Placeholder
      average_latency_ms: 0, // Placeholder
    };
  }

  /**
   * Get replan metrics
   */
  private async getReplanMetrics(): Promise<SystemMetrics['replan']> {
    const triggersResult = await query(
      `SELECT COUNT(*) as total FROM replan_triggers
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    );

    const proposalsResult = await query(
      `SELECT COUNT(*) as total FROM replan_proposals
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    );

    const applicationsResult = await query(
      `SELECT COUNT(*) as total FROM replan_applications
       WHERE applied_at > NOW() - INTERVAL '24 hours' AND rolled_back = FALSE`
    );

    return {
      total_triggers: parseInt(triggersResult.rows[0].total, 10),
      proposals_generated: parseInt(proposalsResult.rows[0].total, 10),
      applications_successful: parseInt(applicationsResult.rows[0].total, 10),
    };
  }

  /**
   * Get API metrics
   */
  private getApiMetrics(): SystemMetrics['api'] {
    const avgResponseTime = this.requestCount > 0
      ? this.totalResponseTime / this.requestCount
      : 0;

    const errorRate = this.requestCount > 0
      ? (this.errorCount / this.requestCount) * 100
      : 0;

    return {
      total_requests: this.requestCount,
      average_response_time_ms: avgResponseTime,
      error_rate: errorRate,
    };
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): SystemMetrics['system'] {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

    return {
      uptime_seconds: uptime,
      memory_usage_mb: Math.round(memoryUsage * 100) / 100,
      database_connections: getPoolStats().total,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.requestCount = 0;
    this.totalResponseTime = 0;
    this.errorCount = 0;
  }
}

export const metricsService = new MetricsService();
