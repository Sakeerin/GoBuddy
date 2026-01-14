import { bookingService } from '@/services/booking/booking.service';
import { bookingOrchestratorService } from '@/services/booking/booking-orchestrator.service';
import { adminService } from './admin.service';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import { Booking, BookingStatus } from '@/types/booking';

export class BookingTroubleshootingService {
  /**
   * Get booking details for troubleshooting
   */
  async getBookingDetails(bookingId: string): Promise<{
    booking: Booking;
    state_history: Array<{
      from_status: BookingStatus | null;
      to_status: BookingStatus;
      reason?: string;
      changed_by?: string;
      created_at: Date;
    }>;
    provider_health?: {
      healthy: boolean;
      latency_ms?: number;
    };
  }> {
    const booking = await bookingService.getBookingById(bookingId);
    const history = await bookingService.getBookingStateHistory(bookingId);

    // Check provider health
    let providerHealth;
    try {
      const provider = providerRegistry.getProvider(booking.provider_id);
      if (provider) {
        const startTime = Date.now();
        const healthy = await provider.healthCheck();
        providerHealth = {
          healthy,
          latency_ms: Date.now() - startTime,
        };
      }
    } catch (error) {
      logger.warn('Failed to check provider health', { bookingId, error });
    }

    return {
      booking,
      state_history: history,
      provider_health: providerHealth,
    };
  }

  /**
   * Resend voucher
   */
  async resendVoucher(bookingId: string, adminId: string): Promise<void> {
    const booking = await bookingService.getBookingById(bookingId);

    if (!booking.voucher_url && !booking.voucher_data) {
      throw new NotFoundError('Voucher', bookingId);
    }

    // TODO: Implement email sending
    // For now, just log the action
    await adminService.logAdminAction(
      adminId,
      'voucher_resent',
      'booking',
      bookingId
    );

    logger.info('Voucher resend requested', { bookingId, adminId });
  }

  /**
   * Manual override booking status
   */
  async overrideBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    reason: string,
    adminId: string
  ): Promise<Booking> {
    const booking = await bookingService.updateBookingStatus(
      bookingId,
      newStatus,
      `Manual override by admin: ${reason}`,
      adminId
    );

    await adminService.logAdminAction(
      adminId,
      'booking_status_override',
      'booking',
      bookingId,
      {
        from_status: booking.status,
        to_status: newStatus,
        reason,
      }
    );

    logger.warn('Booking status manually overridden', {
      bookingId,
      newStatus,
      reason,
      adminId,
    });

    return booking;
  }

  /**
   * Get booking statistics
   */
  async getBookingStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    by_status: Record<BookingStatus, number>;
    by_provider: Record<string, number>;
    success_rate: number;
    average_processing_time_ms: number;
  }> {
    let queryText = `
      SELECT
        COUNT(*) as total,
        status,
        provider_id,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_time
      FROM bookings
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (startDate) {
      queryText += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += ` GROUP BY status, provider_id`;

    const result = await query(queryText, params);

    const byStatus: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    let total = 0;
    let confirmed = 0;
    let totalTime = 0;

    for (const row of result.rows) {
      total += parseInt(row.total, 10);
      byStatus[row.status] = (byStatus[row.status] || 0) + parseInt(row.total, 10);
      byProvider[row.provider_id] = (byProvider[row.provider_id] || 0) + parseInt(row.total, 10);

      if (row.status === 'confirmed') {
        confirmed += parseInt(row.total, 10);
      }

      if (row.avg_time) {
        totalTime += parseFloat(row.avg_time);
      }
    }

    return {
      total,
      by_status: byStatus as Record<BookingStatus, number>,
      by_provider: byProvider,
      success_rate: total > 0 ? (confirmed / total) * 100 : 0,
      average_processing_time_ms: totalTime / result.rows.length || 0,
    };
  }
}

// Import providerRegistry
import { providerRegistry } from '@/services/providers/provider-registry';

export const bookingTroubleshootingService = new BookingTroubleshootingService();
