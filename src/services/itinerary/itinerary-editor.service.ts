import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { itineraryGeneratorService } from './itinerary-generator.service';
import { itineraryVersionService } from './itinerary-version.service';
import { tripService } from '@/services/trip/trip.service';
import { poiService } from '@/services/poi/poi.service';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError } from '@/utils/errors';
import {
  Itinerary,
  ItineraryItem,
  ItineraryDay,
} from '@/types/itinerary';
import { TripPreferences } from '@/types/trip';

export interface ValidationIssue {
  type: 'time_conflict' | 'opening_hours' | 'distance' | 'budget' | 'time_window';
  severity: 'error' | 'warning';
  message: string;
  item_id?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export class ItineraryEditorService {
  /**
   * Get itinerary item by ID
   */
  async getItemById(itemId: string, tripId: string): Promise<ItineraryItem> {
    const result = await query(
      `SELECT * FROM itinerary_items WHERE id = $1 AND trip_id = $2`,
      [itemId, tripId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Itinerary item', itemId);
    }

    return this.mapRowToItem(result.rows[0]);
  }

  /**
   * Reorder items within a day
   */
  async reorderItems(
    tripId: string,
    day: number,
    itemIds: string[]
  ): Promise<ItineraryItem[]> {
    // Verify all items belong to this trip and day
    const result = await query(
      `SELECT id FROM itinerary_items
       WHERE trip_id = $1 AND day = $2 AND id = ANY($3::uuid[])`,
      [tripId, day, itemIds]
    );

    if (result.rows.length !== itemIds.length) {
      throw new ValidationError('Some items not found or belong to different day');
    }

    // Update order
    for (let i = 0; i < itemIds.length; i++) {
      await query(
        `UPDATE itinerary_items SET "order" = $1, updated_at = NOW()
         WHERE id = $2 AND trip_id = $3`,
        [i, itemIds[i], tripId]
      );
    }

    // Recalculate times for the day
    await this.recalculateDayTimes(tripId, day);

    // Create version snapshot
    await this.createVersionSnapshot(tripId, 'reorder');

    // Get updated items
    const itemsResult = await query(
      `SELECT * FROM itinerary_items
       WHERE trip_id = $1 AND day = $2
       ORDER BY "order"`,
      [tripId, day]
    );

    return itemsResult.rows.map((row) => this.mapRowToItem(row));
  }

  /**
   * Pin/unpin an item
   */
  async togglePin(
    tripId: string,
    itemId: string,
    pinned: boolean,
    changedBy?: string
  ): Promise<ItineraryItem> {
    await query(
      `UPDATE itinerary_items
       SET is_pinned = $1, updated_at = NOW()
       WHERE id = $2 AND trip_id = $3`,
      [pinned, itemId, tripId]
    );

    // Create version snapshot
    await this.createVersionSnapshot(tripId, pinned ? 'pin', changedBy);

    return await this.getItemById(itemId, tripId);
  }

  /**
   * Set custom start time for an item
   */
  async setStartTime(
    tripId: string,
    itemId: string,
    startTime: string,
    changedBy?: string
  ): Promise<ItineraryItem> {
    // Validate time format
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime)) {
      throw new ValidationError('Invalid time format. Use HH:mm');
    }

    const item = await this.getItemById(itemId, tripId);

    // Calculate new end time
    const endTime = this.addMinutes(startTime, item.duration_minutes);

    await query(
      `UPDATE itinerary_items
       SET start_time = $1, end_time = $2, updated_at = NOW()
       WHERE id = $3 AND trip_id = $4`,
      [startTime, endTime, itemId, tripId]
    );

    // Recalculate times for the day
    await this.recalculateDayTimes(tripId, item.day);

    // Create version snapshot
    await this.createVersionSnapshot(tripId, 'time_change', changedBy);

    return await this.getItemById(itemId, tripId);
  }

  /**
   * Remove an item
   */
  async removeItem(tripId: string, itemId: string, changedBy?: string): Promise<void> {
    const item = await this.getItemById(itemId, tripId);

    if (item.is_pinned) {
      throw new ValidationError('Cannot remove pinned item. Unpin it first.');
    }

    await query(
      `DELETE FROM itinerary_items WHERE id = $1 AND trip_id = $2`,
      [itemId, tripId]
    );

    // Recalculate times for the day
    await this.recalculateDayTimes(tripId, item.day);

    // Create version snapshot
    await this.createVersionSnapshot(tripId, 'remove', changedBy);

    logger.info('Itinerary item removed', { tripId, itemId, day: item.day });
  }

  /**
   * Add a new item to a day
   */
  async addItem(
    tripId: string,
    day: number,
    poiId: string,
    startTime?: string,
    changedBy?: string
  ): Promise<ItineraryItem> {
    // Get POI
    const poi = await poiService.getPOIById(poiId);

    // Get trip preferences
    const { preferences } = await tripService.getTripWithPreferences(tripId);

    // Get existing items for the day
    const existingItems = await this.getDayItems(tripId, day);

    // Determine start time
    let itemStartTime: string;
    if (startTime) {
      itemStartTime = startTime;
    } else {
      // Use end time of last item or start of time window
      if (existingItems.length > 0) {
        const lastItem = existingItems[existingItems.length - 1];
        itemStartTime = this.addMinutes(
          lastItem.end_time,
          DEFAULT_BUFFER_MINUTES
        );
      } else {
        itemStartTime = preferences.daily_time_window.start;
      }
    }

    const itemEndTime = this.addMinutes(itemStartTime, poi.avg_duration_minutes);

    // Create item
    const itemId = uuidv4();
    const order = existingItems.length;

    await query(
      `INSERT INTO itinerary_items (
        id, trip_id, day, item_type, poi_id, name, description,
        location, start_time, end_time, duration_minutes,
        is_pinned, "order", cost_estimate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        itemId,
        tripId,
        day,
        'poi',
        poi.id,
        poi.name,
        poi.description || null,
        JSON.stringify(poi.location),
        itemStartTime,
        itemEndTime,
        poi.avg_duration_minutes,
        false,
        order,
        poi.price_range
          ? JSON.stringify({
              amount: (poi.price_range.min + poi.price_range.max) / 2,
              currency: poi.price_range.currency,
              confidence: 'estimated',
            })
          : null,
      ]
    );

    // Recalculate times for the day
    await this.recalculateDayTimes(tripId, day);

    // Create version snapshot
    await this.createVersionSnapshot(tripId, 'add', changedBy);

    return await this.getItemById(itemId, tripId);
  }

  /**
   * Validate itinerary
   */
  async validateItinerary(tripId: string): Promise<ValidationResult> {
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    const { preferences } = await tripService.getTripWithPreferences(tripId);
    const issues: ValidationIssue[] = [];

    for (const day of itinerary.days) {
      // Validate each day
      const dayIssues = await this.validateDay(day, preferences);
      issues.push(...dayIssues);
    }

    return {
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validate a single day
   */
  private async validateDay(
    day: ItineraryDay,
    preferences: TripPreferences
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const timeWindow = preferences.daily_time_window;

    for (let i = 0; i < day.items.length; i++) {
      const item = day.items[i];
      const prevItem = i > 0 ? day.items[i - 1] : null;

      // Check time conflicts
      if (prevItem && item.start_time < prevItem.end_time) {
        issues.push({
          type: 'time_conflict',
          severity: 'error',
          message: `Item "${item.name}" starts before previous item ends`,
          item_id: item.id,
          suggestion: `Move start time to ${prevItem.end_time} or later`,
        });
      }

      // Check opening hours
      if (item.poi_id) {
        const poi = await poiService.getPOIById(item.poi_id);
        const dayOfWeek = new Date(day.date).getDay();
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
        const hours = poi.hours?.[dayName];

        if (hours?.closed) {
          issues.push({
            type: 'opening_hours',
            severity: 'error',
            message: `POI "${item.name}" is closed on this day`,
            item_id: item.id,
            suggestion: 'Remove this item or move to another day',
          });
        } else if (hours?.open && item.start_time < hours.open) {
          issues.push({
            type: 'opening_hours',
            severity: 'error',
            message: `POI "${item.name}" opens at ${hours.open}, but item starts at ${item.start_time}`,
            item_id: item.id,
            suggestion: `Move start time to ${hours.open} or later`,
          });
        } else if (hours?.close && item.end_time > hours.close) {
          issues.push({
            type: 'opening_hours',
            severity: 'error',
            message: `POI "${item.name}" closes at ${hours.close}, but item ends at ${item.end_time}`,
            item_id: item.id,
            suggestion: `Move start time earlier or reduce duration`,
          });
        }
      }

      // Check daily time window
      if (item.start_time < timeWindow.start) {
        issues.push({
          type: 'time_window',
          severity: 'warning',
          message: `Item "${item.name}" starts before daily time window`,
          item_id: item.id,
          suggestion: `Move start time to ${timeWindow.start} or later`,
        });
      }

      if (item.end_time > timeWindow.end) {
        issues.push({
          type: 'time_window',
          severity: 'warning',
          message: `Item "${item.name}" ends after daily time window`,
          item_id: item.id,
          suggestion: `Move start time earlier or reduce duration`,
        });
      }

      // Check distance (if constraint exists)
      if (preferences.constraints.max_walking_km_per_day) {
        const dayDistance = day.items.reduce((sum, it) => {
          return sum + (it.route_from_previous?.distance_km || 0);
        }, 0);

        if (dayDistance > preferences.constraints.max_walking_km_per_day) {
          issues.push({
            type: 'distance',
            severity: 'warning',
            message: `Total walking distance (${dayDistance.toFixed(1)} km) exceeds limit (${preferences.constraints.max_walking_km_per_day} km)`,
            suggestion: 'Consider using transit or taxi for some segments',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Recalculate times for a day after changes
   */
  private async recalculateDayTimes(tripId: string, day: number): Promise<void> {
    const items = await this.getDayItems(tripId, day);
    const { preferences } = await tripService.getTripWithPreferences(tripId);
    const timeWindow = preferences.daily_time_window;

    let currentTime = timeWindow.start;

    for (const item of items) {
      // Skip if pinned and has custom time
      if (item.is_pinned && item.start_time !== currentTime) {
        currentTime = item.end_time;
        continue;
      }

      // Update start time
      const newStartTime = currentTime;
      const newEndTime = this.addMinutes(newStartTime, item.duration_minutes);

      await query(
        `UPDATE itinerary_items
         SET start_time = $1, end_time = $2, updated_at = NOW()
         WHERE id = $3`,
        [newStartTime, newEndTime, item.id]
      );

      currentTime = newEndTime;
    }
  }

  /**
   * Get all items for a day
   */
  private async getDayItems(tripId: string, day: number): Promise<ItineraryItem[]> {
    const result = await query(
      `SELECT * FROM itinerary_items
       WHERE trip_id = $1 AND day = $2
       ORDER BY "order"`,
      [tripId, day]
    );

    return result.rows.map((row) => this.mapRowToItem(row));
  }

  /**
   * Add minutes to time string
   */
  private addMinutes(timeStr: string, minutes: number): string {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  private mapRowToItem(row: any): ItineraryItem {
    return {
      id: row.id,
      trip_id: row.trip_id,
      day: row.day,
      item_type: row.item_type,
      poi_id: row.poi_id,
      name: row.name,
      description: row.description,
      location: row.location
        ? typeof row.location === 'string'
          ? JSON.parse(row.location)
          : row.location
        : undefined,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: row.duration_minutes,
      is_pinned: row.is_pinned,
      order: row.order,
      route_from_previous: row.route_from_previous
        ? typeof row.route_from_previous === 'string'
          ? JSON.parse(row.route_from_previous)
          : row.route_from_previous
        : undefined,
      cost_estimate: row.cost_estimate
        ? typeof row.cost_estimate === 'string'
          ? JSON.parse(row.cost_estimate)
          : row.cost_estimate
        : undefined,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Create version snapshot after edit
   */
  private async createVersionSnapshot(
    tripId: string,
    changeType: 'reorder' | 'pin' | 'unpin' | 'time_change' | 'add' | 'remove',
    changedBy?: string
  ): Promise<void> {
    try {
      const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
      if (!itinerary) return;

      const previousVersion = await itineraryVersionService
        .getVersion(tripId, itinerary.version - 1)
        .catch(() => undefined);

      await itineraryVersionService.createSnapshot(
        tripId,
        changeType,
        changedBy,
        previousVersion
      );
    } catch (error) {
      logger.warn('Failed to create version snapshot', { tripId, changeType, error });
      // Don't throw - versioning is not critical
    }
  }
}

const DEFAULT_BUFFER_MINUTES = 15;

export const itineraryEditorService = new ItineraryEditorService();

