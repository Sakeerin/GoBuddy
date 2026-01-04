import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError, ConflictError } from '@/utils/errors';
import {
  Booking,
  BookingStatus,
  CreateBookingRequest,
  BookingStateHistory,
} from '@/types/booking';

export class BookingService {
  /**
   * Create a new booking
   */
  async createBooking(
    tripId: string,
    request: CreateBookingRequest,
    userId?: string
  ): Promise<Booking> {
    // Check idempotency
    const existing = await this.getBookingByIdempotencyKey(request.idempotency_key);
    if (existing) {
      logger.info('Idempotency key reused, returning existing booking', {
        idempotencyKey: request.idempotency_key,
        bookingId: existing.id,
      });
      return existing;
    }

    // Validate state transitions (from null to pending)
    this.validateStateTransition(null, 'pending');

    // Create booking record (status will be updated by orchestrator)
    const bookingId = uuidv4();
    await query(
      `INSERT INTO bookings (
        id, trip_id, itinerary_item_id, provider_id, external_booking_id,
        status, price, policies, confirmation_number, traveler_details,
        booking_date, booking_time, contact_info, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        bookingId,
        tripId,
        request.itinerary_item_id || null,
        request.provider_id,
        'pending', // Will be updated when provider confirms
        'pending',
        JSON.stringify({ amount: 0, currency: 'THB' }), // Will be updated
        JSON.stringify({ cancellation: '', refund: '' }), // Will be updated
        uuidv4().substring(0, 8).toUpperCase(), // Temporary confirmation number
        JSON.stringify(request.traveler_details),
        request.booking_date,
        request.booking_time || null,
        JSON.stringify(request.contact_info),
        request.metadata ? JSON.stringify(request.metadata) : null,
      ]
    );

    // Create state history
    await this.addStateHistory(bookingId, null, 'pending', 'Booking created', userId);

    // Store idempotency mapping
    await query(
      `INSERT INTO booking_idempotency (idempotency_key, booking_id, created_at)
       VALUES ($1, $2, NOW())`,
      [request.idempotency_key, bookingId]
    );

    logger.info('Booking created', { bookingId, tripId, providerId: request.provider_id });

    return await this.getBookingById(bookingId);
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<Booking> {
    const result = await query(
      `SELECT * FROM bookings WHERE id = $1`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Booking', bookingId);
    }

    return this.mapRowToBooking(result.rows[0]);
  }

  /**
   * Get booking by idempotency key
   */
  async getBookingByIdempotencyKey(idempotencyKey: string): Promise<Booking | null> {
    const result = await query(
      `SELECT b.* FROM bookings b
       INNER JOIN booking_idempotency bi ON b.id = bi.booking_id
       WHERE bi.idempotency_key = $1`,
      [idempotencyKey]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToBooking(result.rows[0]);
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    reason?: string,
    updatedBy?: string,
    updates?: {
      external_booking_id?: string;
      price?: { amount: number; currency: string };
      policies?: { cancellation: string; refund: string; cancellation_deadline?: string };
      voucher_url?: string;
      voucher_data?: string;
      confirmation_number?: string;
    }
  ): Promise<Booking> {
    const booking = await this.getBookingById(bookingId);

    // Validate state transition
    this.validateStateTransition(booking.status, newStatus);

    // Build update query
    const updateFields: string[] = ['status = $1', 'updated_at = NOW()'];
    const values: unknown[] = [newStatus];
    let paramIndex = 2;

    if (updates?.external_booking_id) {
      updateFields.push(`external_booking_id = $${paramIndex}`);
      values.push(updates.external_booking_id);
      paramIndex++;
    }

    if (updates?.price) {
      updateFields.push(`price = $${paramIndex}`);
      values.push(JSON.stringify(updates.price));
      paramIndex++;
    }

    if (updates?.policies) {
      updateFields.push(`policies = $${paramIndex}`);
      values.push(JSON.stringify(updates.policies));
      paramIndex++;
    }

    if (updates?.voucher_url) {
      updateFields.push(`voucher_url = $${paramIndex}`);
      values.push(updates.voucher_url);
      paramIndex++;
    }

    if (updates?.voucher_data) {
      updateFields.push(`voucher_data = $${paramIndex}`);
      values.push(updates.voucher_data);
      paramIndex++;
    }

    if (updates?.confirmation_number) {
      updateFields.push(`confirmation_number = $${paramIndex}`);
      values.push(updates.confirmation_number);
      paramIndex++;
    }

    values.push(bookingId);

    await query(
      `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Add state history
    await this.addStateHistory(bookingId, booking.status, newStatus, reason, updatedBy);

    logger.info('Booking status updated', {
      bookingId,
      from: booking.status,
      to: newStatus,
      reason,
    });

    return await this.getBookingById(bookingId);
  }

  /**
   * Get bookings for a trip
   */
  async getBookingsByTripId(tripId: string): Promise<Booking[]> {
    const result = await query(
      `SELECT * FROM bookings WHERE trip_id = $1 ORDER BY created_at DESC`,
      [tripId]
    );

    return result.rows.map((row) => this.mapRowToBooking(row));
  }

  /**
   * Get booking state history
   */
  async getBookingStateHistory(bookingId: string): Promise<BookingStateHistory[]> {
    const result = await query(
      `SELECT * FROM booking_state_history
       WHERE booking_id = $1
       ORDER BY created_at ASC`,
      [bookingId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      booking_id: row.booking_id,
      from_status: row.from_status,
      to_status: row.to_status,
      reason: row.reason,
      changed_by: row.changed_by,
      created_at: row.created_at,
    }));
  }

  /**
   * Validate state transition
   */
  private validateStateTransition(
    fromStatus: BookingStatus | null,
    toStatus: BookingStatus
  ): void {
    const validTransitions: Record<BookingStatus | 'null', BookingStatus[]> = {
      null: ['pending'],
      pending: ['confirmed', 'failed'],
      confirmed: ['canceled', 'refunded'],
      failed: ['pending'], // Allow retry
      canceled: ['refunded'],
      refunded: [], // Terminal state
    };

    const key = fromStatus || 'null';
    const allowed = validTransitions[key] || [];

    if (!allowed.includes(toStatus)) {
      throw new ValidationError(
        `Invalid state transition from ${fromStatus || 'null'} to ${toStatus}`
      );
    }
  }

  /**
   * Add state history entry
   */
  private async addStateHistory(
    bookingId: string,
    fromStatus: BookingStatus | null,
    toStatus: BookingStatus,
    reason?: string,
    changedBy?: string
  ): Promise<void> {
    await query(
      `INSERT INTO booking_state_history (
        booking_id, from_status, to_status, reason, changed_by
      ) VALUES ($1, $2, $3, $4, $5)`,
      [bookingId, fromStatus, toStatus, reason || null, changedBy || null]
    );
  }

  private mapRowToBooking(row: any): Booking {
    return {
      id: row.id,
      trip_id: row.trip_id,
      itinerary_item_id: row.itinerary_item_id,
      provider_id: row.provider_id,
      provider_type: row.provider_type,
      external_booking_id: row.external_booking_id,
      status: row.status,
      price: typeof row.price === 'string' ? JSON.parse(row.price) : row.price,
      policies: typeof row.policies === 'string' ? JSON.parse(row.policies) : row.policies,
      voucher_url: row.voucher_url,
      voucher_data: row.voucher_data,
      confirmation_number: row.confirmation_number,
      traveler_details: typeof row.traveler_details === 'string'
        ? JSON.parse(row.traveler_details)
        : row.traveler_details,
      booking_date: row.booking_date,
      booking_time: row.booking_time,
      contact_info: typeof row.contact_info === 'string'
        ? JSON.parse(row.contact_info)
        : row.contact_info,
      metadata: row.metadata
        ? typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata
        : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const bookingService = new BookingService();

