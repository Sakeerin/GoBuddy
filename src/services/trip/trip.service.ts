import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError } from '@/utils/errors';
import { Trip, TripPreferences, CreateTripRequest, UpdateTripRequest } from '@/types/trip';

export class TripService {
  /**
   * Create a new trip
   */
  async createTrip(
    userId: string | undefined,
    guestSessionId: string | undefined,
    tripData: CreateTripRequest
  ): Promise<Trip> {
    // Validate that either userId or guestSessionId is provided
    if (!userId && !guestSessionId) {
      throw new ValidationError('Either user_id or guest_session_id is required');
    }

    // Validate dates
    const startDate = new Date(tripData.dates.start);
    const endDate = new Date(tripData.dates.end);
    if (startDate >= endDate) {
      throw new ValidationError('End date must be after start date');
    }
    if (startDate < new Date()) {
      throw new ValidationError('Start date cannot be in the past');
    }

    // Validate travelers
    if (tripData.travelers.adults < 1) {
      throw new ValidationError('At least one adult traveler is required');
    }
    if (tripData.travelers.children < 0 || tripData.travelers.seniors < 0) {
      throw new ValidationError('Traveler counts cannot be negative');
    }

    // Validate budget
    if (tripData.budget.total && tripData.budget.total < 0) {
      throw new ValidationError('Total budget cannot be negative');
    }
    if (tripData.budget.per_day && tripData.budget.per_day < 0) {
      throw new ValidationError('Per-day budget cannot be negative');
    }

    // Validate time window
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(tripData.daily_time_window.start) || !timeRegex.test(tripData.daily_time_window.end)) {
      throw new ValidationError('Time window must be in HH:mm format');
    }

    // Create trip
    const tripResult = await query(
      `INSERT INTO trips (user_id, guest_session_id, status)
       VALUES ($1, $2, 'draft')
       RETURNING *`,
      [userId || null, guestSessionId || null]
    );

    const trip = this.mapRowToTrip(tripResult.rows[0]);

    // Create trip preferences
    await query(
      `INSERT INTO trip_preferences (
        trip_id, destination, dates, travelers, budget,
        style, daily_time_window, constraints
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        trip.id,
        JSON.stringify(tripData.destination),
        JSON.stringify({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        }),
        JSON.stringify(tripData.travelers),
        JSON.stringify(tripData.budget),
        tripData.style,
        JSON.stringify(tripData.daily_time_window),
        JSON.stringify(tripData.constraints),
      ]
    );

    logger.info('Trip created', { tripId: trip.id, userId, guestSessionId });
    return trip;
  }

  /**
   * Get trip by ID
   */
  async getTripById(tripId: string, userId?: string, guestSessionId?: string): Promise<Trip> {
    let queryText = `SELECT * FROM trips WHERE id = $1`;
    const params: (string | undefined)[] = [tripId];

    // Add authorization check
    if (userId) {
      queryText += ` AND user_id = $2`;
      params.push(userId);
    } else if (guestSessionId) {
      queryText += ` AND guest_session_id = $2`;
      params.push(guestSessionId);
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      throw new NotFoundError('Trip', tripId);
    }

    return this.mapRowToTrip(result.rows[0]);
  }

  /**
   * Get trip with preferences
   */
  async getTripWithPreferences(
    tripId: string,
    userId?: string,
    guestSessionId?: string
  ): Promise<{ trip: Trip; preferences: TripPreferences }> {
    const trip = await this.getTripById(tripId, userId, guestSessionId);

    const prefsResult = await query(
      `SELECT * FROM trip_preferences WHERE trip_id = $1`,
      [tripId]
    );

    if (prefsResult.rows.length === 0) {
      throw new NotFoundError('Trip preferences', tripId);
    }

    const preferences = this.mapRowToPreferences(prefsResult.rows[0]);

    return { trip, preferences };
  }

  /**
   * List trips for user or guest
   */
  async listTrips(
    userId?: string,
    guestSessionId?: string,
    status?: string
  ): Promise<Trip[]> {
    let queryText = 'SELECT * FROM trips WHERE';
    const params: (string | undefined)[] = [];

    if (userId) {
      queryText += ` user_id = $1`;
      params.push(userId);
    } else if (guestSessionId) {
      queryText += ` guest_session_id = $1`;
      params.push(guestSessionId);
    } else {
      throw new ValidationError('Either user_id or guest_session_id is required');
    }

    if (status) {
      queryText += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    queryText += ` ORDER BY created_at DESC`;

    const result = await query(queryText, params);
    return result.rows.map((row) => this.mapRowToTrip(row));
  }

  /**
   * Update trip
   */
  async updateTrip(
    tripId: string,
    userId: string | undefined,
    guestSessionId: string | undefined,
    updates: UpdateTripRequest
  ): Promise<Trip> {
    // Verify trip exists and user has access
    await this.getTripById(tripId, userId, guestSessionId);

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.destination) {
      updateFields.push(`destination = $${paramIndex}`);
      values.push(JSON.stringify(updates.destination));
      paramIndex++;
    }

    if (updates.dates) {
      const dates: { start?: string; end?: string } = {};
      if (updates.dates.start) {
        dates.start = new Date(updates.dates.start).toISOString();
      }
      if (updates.dates.end) {
        dates.end = new Date(updates.dates.end).toISOString();
      }
      updateFields.push(`dates = $${paramIndex}`);
      values.push(JSON.stringify(dates));
      paramIndex++;
    }

    if (updates.travelers) {
      updateFields.push(`travelers = $${paramIndex}`);
      values.push(JSON.stringify(updates.travelers));
      paramIndex++;
    }

    if (updates.budget) {
      updateFields.push(`budget = $${paramIndex}`);
      values.push(JSON.stringify(updates.budget));
      paramIndex++;
    }

    if (updates.style) {
      updateFields.push(`style = $${paramIndex}`);
      values.push(updates.style);
      paramIndex++;
    }

    if (updates.daily_time_window) {
      updateFields.push(`daily_time_window = $${paramIndex}`);
      values.push(JSON.stringify(updates.daily_time_window));
      paramIndex++;
    }

    if (updates.constraints) {
      updateFields.push(`constraints = $${paramIndex}`);
      values.push(JSON.stringify(updates.constraints));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      // No updates provided, return existing trip
      return await this.getTripById(tripId, userId, guestSessionId);
    }

    values.push(tripId);
    const updateQuery = `
      UPDATE trip_preferences
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE trip_id = $${paramIndex}
    `;

    await query(updateQuery, values);

    // Update trip updated_at
    await query(
      `UPDATE trips SET updated_at = NOW() WHERE id = $1`,
      [tripId]
    );

    logger.info('Trip updated', { tripId });
    return await this.getTripById(tripId, userId, guestSessionId);
  }

  /**
   * Delete trip
   */
  async deleteTrip(
    tripId: string,
    userId: string | undefined,
    guestSessionId: string | undefined
  ): Promise<void> {
    // Verify trip exists and user has access
    await this.getTripById(tripId, userId, guestSessionId);

    // Delete trip (cascade will delete preferences)
    await query(`DELETE FROM trips WHERE id = $1`, [tripId]);

    logger.info('Trip deleted', { tripId });
  }

  /**
   * Update trip status
   */
  async updateTripStatus(
    tripId: string,
    status: Trip['status'],
    userId?: string,
    guestSessionId?: string
  ): Promise<Trip> {
    await this.getTripById(tripId, userId, guestSessionId);

    await query(
      `UPDATE trips SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, tripId]
    );

    return await this.getTripById(tripId, userId, guestSessionId);
  }

  private mapRowToTrip(row: any): Trip {
    return {
      id: row.id,
      user_id: row.user_id,
      guest_session_id: row.guest_session_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapRowToPreferences(row: any): TripPreferences {
    const destination = typeof row.destination === 'string'
      ? JSON.parse(row.destination)
      : row.destination;

    const dates = typeof row.dates === 'string'
      ? JSON.parse(row.dates)
      : row.dates;

    const travelers = typeof row.travelers === 'string'
      ? JSON.parse(row.travelers)
      : row.travelers;

    const budget = typeof row.budget === 'string'
      ? JSON.parse(row.budget)
      : row.budget;

    const dailyTimeWindow = typeof row.daily_time_window === 'string'
      ? JSON.parse(row.daily_time_window)
      : row.daily_time_window;

    const constraints = typeof row.constraints === 'string'
      ? JSON.parse(row.constraints)
      : row.constraints;

    return {
      trip_id: row.trip_id,
      destination,
      dates: {
        start: new Date(dates.start),
        end: new Date(dates.end),
      },
      travelers,
      budget,
      style: row.style,
      daily_time_window: dailyTimeWindow,
      constraints,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const tripService = new TripService();

