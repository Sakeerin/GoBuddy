import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import {
  EventSignal,
  EventType,
  EventSeverity,
  WeatherEventDetails,
  ReplanTrigger,
} from '@/types/events';
import { itineraryGeneratorService } from '@/services/itinerary/itinerary-generator.service';
import { Itinerary, ItineraryItem } from '@/types/itinerary';

export class EventMonitorService {
  /**
   * Ingest weather event
   */
  async ingestWeatherEvent(
    tripId: string,
    location: { lat: number; lng: number },
    timeSlot: { start: string; end: string },
    details: WeatherEventDetails,
    severity: EventSeverity
  ): Promise<EventSignal> {
    // Find affected itinerary items
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    const affectedItems = this.findAffectedItems(itinerary, location, timeSlot, 'weather');

    // Create event signal
    const eventId = uuidv4();
    await query(
      `INSERT INTO event_signals (
        id, trip_id, event_type, severity, location, time_slot, details, affected_items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventId,
        tripId,
        'weather',
        severity,
        JSON.stringify(location),
        JSON.stringify(timeSlot),
        JSON.stringify(details),
        affectedItems,
      ]
    );

    logger.info('Weather event ingested', {
      eventId,
      tripId,
      severity,
      affectedItemsCount: affectedItems.length,
    });

    // Check if replan should be triggered
    if (severity === 'high' && details.condition === 'heavy_rain') {
      await this.createReplanTrigger(tripId, eventId, 'Heavy rain affects outdoor activities');
    }

    return await this.getEventSignalById(eventId);
  }

  /**
   * Ingest closure event
   */
  async ingestClosureEvent(
    tripId: string,
    location: { lat: number; lng: number },
    timeSlot: { start: string; end: string },
    details: { place_id: string; reason: string },
    severity: EventSeverity
  ): Promise<EventSignal> {
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    const affectedItems = this.findAffectedItems(itinerary, location, timeSlot, 'closure');

    const eventId = uuidv4();
    await query(
      `INSERT INTO event_signals (
        id, trip_id, event_type, severity, location, time_slot, details, affected_items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventId,
        tripId,
        'closure',
        severity,
        JSON.stringify(location),
        JSON.stringify(timeSlot),
        JSON.stringify(details),
        affectedItems,
      ]
    );

    if (severity === 'high' || severity === 'medium') {
      await this.createReplanTrigger(tripId, eventId, 'Place closure affects itinerary');
    }

    return await this.getEventSignalById(eventId);
  }

  /**
   * Get event signals for a trip
   */
  async getEventSignals(tripId: string, processed?: boolean): Promise<EventSignal[]> {
    let queryText = `SELECT * FROM event_signals WHERE trip_id = $1`;
    const params: unknown[] = [tripId];

    if (processed !== undefined) {
      queryText += ` AND processed = $2`;
      params.push(processed);
    }

    queryText += ` ORDER BY detected_at DESC`;

    const result = await query(queryText, params);
    return result.rows.map((row) => this.mapRowToEventSignal(row));
  }

  /**
   * Get event signal by ID
   */
  async getEventSignalById(eventId: string): Promise<EventSignal> {
    const result = await query(
      `SELECT * FROM event_signals WHERE id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Event signal', eventId);
    }

    return this.mapRowToEventSignal(result.rows[0]);
  }

  /**
   * Create replan trigger
   */
  async createReplanTrigger(
    tripId: string,
    eventSignalId: string,
    reason: string,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<ReplanTrigger> {
    const triggerId = uuidv4();

    await query(
      `INSERT INTO replan_triggers (
        id, trip_id, event_signal_id, reason, priority
      ) VALUES ($1, $2, $3, $4, $5)`,
      [triggerId, tripId, eventSignalId, reason, priority]
    );

    logger.info('Replan trigger created', { triggerId, tripId, reason, priority });

    return {
      id: triggerId,
      trip_id: tripId,
      event_signal_id: eventSignalId,
      reason,
      priority,
      created_at: new Date(),
      processed: false,
    };
  }

  /**
   * Get pending replan triggers
   */
  async getPendingReplanTriggers(tripId?: string): Promise<ReplanTrigger[]> {
    let queryText = `SELECT * FROM replan_triggers WHERE processed = FALSE`;
    const params: unknown[] = [];

    if (tripId) {
      queryText += ` AND trip_id = $1`;
      params.push(tripId);
    }

    queryText += ` ORDER BY priority DESC, created_at ASC`;

    const result = await query(queryText, params);
    return result.rows.map((row) => ({
      id: row.id,
      trip_id: row.trip_id,
      event_signal_id: row.event_signal_id,
      reason: row.reason,
      priority: row.priority,
      created_at: row.created_at,
      processed: row.processed,
    }));
  }

  /**
   * Mark trigger as processed
   */
  async markTriggerProcessed(triggerId: string): Promise<void> {
    await query(
      `UPDATE replan_triggers SET processed = TRUE WHERE id = $1`,
      [triggerId]
    );
  }

  /**
   * Mark event signal as processed
   */
  async markEventProcessed(eventId: string): Promise<void> {
    await query(
      `UPDATE event_signals SET processed = TRUE WHERE id = $1`,
      [eventId]
    );
  }

  /**
   * Find affected itinerary items
   */
  private findAffectedItems(
    itinerary: Itinerary,
    location: { lat: number; lng: number },
    timeSlot: { start: string; end: string },
    eventType: EventType
  ): string[] {
    const affected: string[] = [];
    const eventStart = new Date(timeSlot.start);
    const eventEnd = new Date(timeSlot.end);

    for (const day of itinerary.days) {
      for (const item of day.items) {
        // Check if item time overlaps with event time
        const itemDate = new Date(day.date);
        const itemStart = new Date(`${day.date}T${item.start_time}:00`);
        const itemEnd = new Date(`${day.date}T${item.end_time}:00`);

        if (itemStart < eventEnd && itemEnd > eventStart) {
          // Check location proximity (within 5km for weather events)
          if (eventType === 'weather' && item.location) {
            const distance = this.calculateDistance(
              location.lat,
              location.lng,
              item.location.lat,
              item.location.lng
            );

            if (distance <= 5) {
              // Check if it's an outdoor activity
              if (this.isOutdoorActivity(item)) {
                affected.push(item.id);
              }
            }
          } else if (eventType === 'closure' && item.location) {
            // For closures, check exact location match
            const distance = this.calculateDistance(
              location.lat,
              location.lng,
              item.location.lat,
              item.location.lng
            );

            if (distance <= 0.5) { // Within 500m
              affected.push(item.id);
            }
          }
        }
      }
    }

    return affected;
  }

  /**
   * Check if item is outdoor activity
   */
  private isOutdoorActivity(item: ItineraryItem): boolean {
    // Simple heuristic: check if item has tags or name suggests outdoor
    const outdoorKeywords = ['outdoor', 'park', 'beach', 'hiking', 'walking', 'tour', 'market'];
    const name = item.name.toLowerCase();
    return outdoorKeywords.some((keyword) => name.includes(keyword));
  }

  /**
   * Calculate distance between two points (Haversine)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private mapRowToEventSignal(row: any): EventSignal {
    return {
      id: row.id,
      trip_id: row.trip_id,
      event_type: row.event_type,
      severity: row.severity,
      location: typeof row.location === 'string' ? JSON.parse(row.location) : row.location,
      time_slot: typeof row.time_slot === 'string' ? JSON.parse(row.time_slot) : row.time_slot,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      affected_items: row.affected_items || [],
      detected_at: row.detected_at,
      processed: row.processed,
      replan_triggered: row.replan_triggered,
    };
  }
}

export const eventMonitorService = new EventMonitorService();

