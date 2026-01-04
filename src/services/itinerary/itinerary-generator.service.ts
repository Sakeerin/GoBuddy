import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { tripService } from '@/services/trip/trip.service';
import { poiService } from '@/services/poi/poi.service';
import { itineraryVersionService } from './itinerary-version.service';
import { logger } from '@/utils/logger';
import { ValidationError, NotFoundError } from '@/utils/errors';
import {
  Itinerary,
  ItineraryItem,
  ItineraryDay,
  ItineraryGenerationResult,
  GenerateItineraryRequest,
  RouteSegment,
} from '@/types/itinerary';
import { POI } from '@/types/poi';
import { TripPreferences } from '@/types/trip';

const DEFAULT_BUFFER_MINUTES = 15; // Default buffer between activities
const DEFAULT_TRAVEL_TIME_PLACEHOLDER = 20; // Placeholder travel time in minutes

export class ItineraryGeneratorService {
  /**
   * Generate itinerary for a trip
   */
  async generateItinerary(
    tripId: string,
    request: GenerateItineraryRequest,
    userId?: string,
    guestSessionId?: string
  ): Promise<ItineraryGenerationResult> {
    // Get trip and preferences
    const { trip, preferences } = await tripService.getTripWithPreferences(
      tripId,
      userId,
      guestSessionId
    );

    // Get selected POIs
    const pois: POI[] = [];
    for (const poiId of request.selected_poi_ids) {
      try {
        const poi = await poiService.getPOIById(poiId);
        pois.push(poi);
      } catch (error) {
        logger.warn('POI not found, skipping', { poiId, error });
      }
    }

    if (pois.length === 0) {
      throw new ValidationError('At least one valid POI is required');
    }

    // Get existing itinerary if incremental mode
    let existingItinerary: Itinerary | null = null;
    if (request.regenerate_mode === 'incremental') {
      existingItinerary = await this.getItineraryByTripId(tripId);
    }

    // Generate day-by-day itinerary
    const days = this.generateDays(
      pois,
      preferences,
      existingItinerary,
      request.preserve_pinned || false
    );

    // Calculate total cost
    const totalCost = this.calculateTotalCost(days, preferences.budget.currency);

    // Save itinerary to database
    const itineraryId = await this.saveItinerary(tripId, days, existingItinerary?.version || 0);

    // Create version snapshot
    const previousVersion = existingItinerary
      ? await itineraryVersionService.getVersion(tripId, existingItinerary.version).catch(() => undefined)
      : undefined;

    await itineraryVersionService.createSnapshot(
      tripId,
      request.regenerate_mode === 'incremental' ? 'edit' : 'generate',
      userId || guestSessionId,
      previousVersion
    );

    logger.info('Itinerary generated', {
      tripId,
      itineraryId,
      daysCount: days.length,
      itemsCount: days.reduce((sum, day) => sum + day.items.length, 0),
    });

    return {
      itinerary_id: itineraryId,
      days,
      total_cost_estimate: totalCost,
      generated_at: new Date(),
    };
  }

  /**
   * Generate day-by-day itinerary
   */
  private generateDays(
    pois: POI[],
    preferences: TripPreferences,
    existingItinerary: Itinerary | null,
    preservePinned: boolean
  ): ItineraryDay[] {
    const days: ItineraryDay[] = [];
    const startDate = new Date(preferences.dates.start);
    const endDate = new Date(preferences.dates.end);
    const numDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get pinned items if preserving
    const pinnedItems = preservePinned && existingItinerary
      ? this.extractPinnedItems(existingItinerary)
      : new Map<string, ItineraryItem>();

    // Distribute POIs across days
    const poisPerDay = this.distributePOIs(pois, numDays, preferences);

    // Generate each day
    for (let dayNum = 1; dayNum <= numDays; dayNum++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayNum - 1);

      const dayPOIs = poisPerDay[dayNum - 1] || [];
      const dayItems = this.generateDayItems(
        dayNum,
        date,
        dayPOIs,
        preferences,
        pinnedItems.get(dayNum) || []
      );

      const day: ItineraryDay = {
        day: dayNum,
        date: date.toISOString().split('T')[0],
        items: dayItems,
        total_travel_time_minutes: this.calculateDayTravelTime(dayItems),
        total_cost_estimate: this.calculateDayCost(dayItems, preferences.budget.currency),
      };

      days.push(day);
    }

    return days;
  }

  /**
   * Distribute POIs across days
   */
  private distributePOIs(
    pois: POI[],
    numDays: number,
    preferences: TripPreferences
  ): POI[][] {
    const poisPerDay: POI[][] = Array(numDays).fill(null).map(() => []);

    // Simple round-robin distribution
    // In future, can optimize based on location proximity
    pois.forEach((poi, index) => {
      const dayIndex = index % numDays;
      poisPerDay[dayIndex].push(poi);
    });

    return poisPerDay;
  }

  /**
   * Generate items for a single day
   */
  private generateDayItems(
    dayNum: number,
    date: Date,
    pois: POI[],
    preferences: TripPreferences,
    pinnedItems: ItineraryItem[]
  ): ItineraryItem[] {
    const items: ItineraryItem[] = [];
    const timeWindow = preferences.daily_time_window;
    const startHour = parseInt(timeWindow.start.split(':')[0], 10);
    const startMinute = parseInt(timeWindow.start.split(':')[1], 10);
    const endHour = parseInt(timeWindow.end.split(':')[0], 10);
    const endMinute = parseInt(timeWindow.end.split(':')[1], 10);

    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);

    // Add pinned items first
    for (const pinnedItem of pinnedItems) {
      items.push(pinnedItem);
      // Update current time to after pinned item
      const pinnedEnd = this.parseTime(pinnedItem.end_time);
      if (pinnedEnd > currentTime) {
        currentTime = new Date(pinnedEnd);
      }
    }

    // Add POIs
    for (let i = 0; i < pois.length; i++) {
      const poi = pois[i];
      const prevItem = items[items.length - 1];

      // Check if we have time left in the day
      if (currentTime >= endTime) {
        logger.warn('Day time window exceeded, skipping remaining POIs', {
          dayNum,
          remainingPOIs: pois.length - i,
        });
        break;
      }

      // Get POI opening hours for this day
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
      const hours = poi.hours?.[dayOfWeek];

      if (hours?.closed) {
        logger.warn('POI is closed on this day, skipping', { poiId: poi.id, dayOfWeek });
        continue;
      }

      // Calculate start time (respect opening hours)
      let itemStartTime = new Date(currentTime);
      if (hours?.open) {
        const openTime = this.parseTime(hours.open, date);
        if (openTime > itemStartTime) {
          itemStartTime = openTime;
        }
      }

      // Check if we can fit this activity
      const duration = poi.avg_duration_minutes;
      const itemEndTime = new Date(itemStartTime.getTime() + duration * 60 * 1000);

      // Check closing hours
      if (hours?.close) {
        const closeTime = this.parseTime(hours.close, date);
        if (itemEndTime > closeTime) {
          logger.warn('POI closes before activity can complete, skipping', {
            poiId: poi.id,
            itemEndTime: itemEndTime.toISOString(),
            closeTime: closeTime.toISOString(),
          });
          continue;
        }
      }

      // Check daily time window
      if (itemEndTime > endTime) {
        logger.warn('Activity exceeds daily time window, skipping', {
          poiId: poi.id,
          itemEndTime: itemEndTime.toISOString(),
          endTime: endTime.toISOString(),
        });
        break;
      }

      // Add travel time from previous item (placeholder)
      let routeFromPrevious: RouteSegment | undefined;
      if (prevItem && prevItem.location) {
        routeFromPrevious = {
          from_item_id: prevItem.id,
          to_item_id: uuidv4(), // Will be set after item creation
          mode: 'walking', // Default, can be changed later
          distance_km: this.calculateDistance(
            prevItem.location.lat,
            prevItem.location.lng,
            poi.location.lat,
            poi.location.lng
          ),
          duration_minutes: DEFAULT_TRAVEL_TIME_PLACEHOLDER,
        };

        // Add buffer time
        itemStartTime = new Date(
          itemStartTime.getTime() + (DEFAULT_BUFFER_MINUTES + routeFromPrevious.duration_minutes) * 60 * 1000
        );
      } else {
        // Add buffer for first item
        itemStartTime = new Date(itemStartTime.getTime() + DEFAULT_BUFFER_MINUTES * 60 * 1000);
      }

      // Recalculate end time after travel time
      const finalEndTime = new Date(itemStartTime.getTime() + duration * 60 * 1000);

      // Check again if it fits
      if (finalEndTime > endTime || (hours?.close && finalEndTime > this.parseTime(hours.close, date))) {
        logger.warn('Activity does not fit after travel time, skipping', { poiId: poi.id });
        continue;
      }

      // Create itinerary item
      const item: ItineraryItem = {
        id: uuidv4(),
        trip_id: '', // Will be set when saving
        day: dayNum,
        item_type: 'poi',
        poi_id: poi.id,
        name: poi.name,
        description: poi.description,
        location: poi.location,
        start_time: this.formatTime(itemStartTime),
        end_time: this.formatTime(finalEndTime),
        duration_minutes: duration,
        is_pinned: false,
        order: items.length,
        route_from_previous: routeFromPrevious,
        cost_estimate: poi.price_range
          ? {
              amount: (poi.price_range.min + poi.price_range.max) / 2,
              currency: poi.price_range.currency,
              confidence: 'estimated',
            }
          : undefined,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Update route segment with correct to_item_id
      if (routeFromPrevious) {
        routeFromPrevious.to_item_id = item.id;
      }

      items.push(item);
      currentTime = new Date(finalEndTime);
    }

    return items;
  }

  /**
   * Calculate distance between two points (Haversine formula)
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

  /**
   * Parse time string (HH:mm) to Date
   */
  private parseTime(timeStr: string, baseDate?: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = baseDate ? new Date(baseDate) : new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Format Date to time string (HH:mm)
   */
  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * Calculate total travel time for a day
   */
  private calculateDayTravelTime(items: ItineraryItem[]): number {
    return items.reduce((sum, item) => {
      return sum + (item.route_from_previous?.duration_minutes || 0);
    }, 0);
  }

  /**
   * Calculate total cost for a day
   */
  private calculateDayCost(items: ItineraryItem[], currency: string): { amount: number; currency: string } {
    const total = items.reduce((sum, item) => {
      return sum + (item.cost_estimate?.amount || 0);
    }, 0);

    return { amount: total, currency };
  }

  /**
   * Calculate total cost for all days
   */
  private calculateTotalCost(days: ItineraryDay[], currency: string): { amount: number; currency: string } {
    const total = days.reduce((sum, day) => {
      return sum + day.total_cost_estimate.amount;
    }, 0);

    return { amount: total, currency };
  }

  /**
   * Extract pinned items from existing itinerary
   */
  private extractPinnedItems(itinerary: Itinerary): Map<number, ItineraryItem[]> {
    const pinned = new Map<number, ItineraryItem[]>();

    for (const day of itinerary.days) {
      const dayPinned = day.items.filter((item) => item.is_pinned);
      if (dayPinned.length > 0) {
        pinned.set(day.day, dayPinned);
      }
    }

    return pinned;
  }

  /**
   * Save itinerary to database
   */
  private async saveItinerary(
    tripId: string,
    days: ItineraryDay[],
    currentVersion: number
  ): Promise<string> {
    const itineraryId = uuidv4();
    const newVersion = currentVersion + 1;

    // Delete old itinerary items
    await query(
      `DELETE FROM itinerary_items WHERE trip_id = $1`,
      [tripId]
    );

    // Insert new items
    for (const day of days) {
      for (const item of day.items) {
        await query(
          `INSERT INTO itinerary_items (
            id, trip_id, day, item_type, poi_id, name, description,
            location, start_time, end_time, duration_minutes,
            is_pinned, "order", route_from_previous, cost_estimate, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            item.id,
            tripId,
            item.day,
            item.item_type,
            item.poi_id || null,
            item.name,
            item.description || null,
            item.location ? JSON.stringify(item.location) : null,
            item.start_time,
            item.end_time,
            item.duration_minutes,
            item.is_pinned,
            item.order,
            item.route_from_previous ? JSON.stringify(item.route_from_previous) : null,
            item.cost_estimate ? JSON.stringify(item.cost_estimate) : null,
            item.notes || null,
          ]
        );
      }
    }

    // Update or create itinerary record
    await query(
      `INSERT INTO itineraries (id, trip_id, version, generated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (trip_id) DO UPDATE SET
         version = EXCLUDED.version,
         generated_at = EXCLUDED.generated_at`,
      [itineraryId, tripId, newVersion]
    );

    return itineraryId;
  }

  /**
   * Get itinerary by trip ID
   */
  async getItineraryByTripId(tripId: string): Promise<Itinerary | null> {
    const itineraryResult = await query(
      `SELECT * FROM itineraries WHERE trip_id = $1`,
      [tripId]
    );

    if (itineraryResult.rows.length === 0) {
      return null;
    }

    const itemsResult = await query(
      `SELECT * FROM itinerary_items
       WHERE trip_id = $1
       ORDER BY day, "order"`,
      [tripId]
    );

    const items = itemsResult.rows.map((row) => this.mapRowToItem(row));

    // Group items by day
    const daysMap = new Map<number, ItineraryItem[]>();
    for (const item of items) {
      if (!daysMap.has(item.day)) {
        daysMap.set(item.day, []);
      }
      daysMap.get(item.day)!.push(item);
    }

    // Get trip to get dates
    const { preferences } = await tripService.getTripWithPreferences(tripId);
    const startDate = new Date(preferences.dates.start);

    const days: ItineraryDay[] = [];
    for (const [dayNum, dayItems] of daysMap.entries()) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayNum - 1);

      days.push({
        day: dayNum,
        date: date.toISOString().split('T')[0],
        items: dayItems,
        total_travel_time_minutes: this.calculateDayTravelTime(dayItems),
        total_cost_estimate: this.calculateDayCost(dayItems, preferences.budget.currency),
      });
    }

    // Sort days by day number
    days.sort((a, b) => a.day - b.day);

    const totalCost = this.calculateTotalCost(days, preferences.budget.currency);

    return {
      id: itineraryResult.rows[0].id,
      trip_id: tripId,
      days,
      total_cost_estimate: totalCost,
      generated_at: itineraryResult.rows[0].generated_at,
      version: itineraryResult.rows[0].version,
    };
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
      location: row.location ? (typeof row.location === 'string' ? JSON.parse(row.location) : row.location) : undefined,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: row.duration_minutes,
      is_pinned: row.is_pinned,
      order: row.order,
      route_from_previous: row.route_from_previous
        ? (typeof row.route_from_previous === 'string'
            ? JSON.parse(row.route_from_previous)
            : row.route_from_previous)
        : undefined,
      cost_estimate: row.cost_estimate
        ? (typeof row.cost_estimate === 'string'
            ? JSON.parse(row.cost_estimate)
            : row.cost_estimate)
        : undefined,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const itineraryGeneratorService = new ItineraryGeneratorService();

