import { query } from '@/config/database';
import { routingService } from '@/services/routing/routing.service';
import { itineraryGeneratorService } from './itinerary-generator.service';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import { Itinerary, ItineraryItem } from '@/types/itinerary';
import { RouteResponse, TransportationMode } from '@/types/routing';

/**
 * Service to handle routing for itinerary items
 */
export class ItineraryRoutingService {
  /**
   * Update route for a specific item
   */
  async updateItemRoute(
    tripId: string,
    itemId: string,
    mode: TransportationMode
  ): Promise<ItineraryItem> {
    // Get item and previous item
    const itemResult = await query(
      `SELECT * FROM itinerary_items WHERE id = $1 AND trip_id = $2`,
      [itemId, tripId]
    );

    if (itemResult.rows.length === 0) {
      throw new NotFoundError('Itinerary item', itemId);
    }

    const item = this.mapRowToItem(itemResult.rows[0]);

    if (!item.location) {
      throw new Error('Item does not have location');
    }

    // Get previous item
    const prevItemResult = await query(
      `SELECT * FROM itinerary_items
       WHERE trip_id = $1 AND day = $2 AND "order" < $3
       ORDER BY "order" DESC
       LIMIT 1`,
      [tripId, item.day, item.order]
    );

    if (prevItemResult.rows.length === 0) {
      // First item of the day, no route to update
      return item;
    }

    const prevItem = this.mapRowToItem(prevItemResult.rows[0]);
    if (!prevItem.location) {
      throw new Error('Previous item does not have location');
    }

    // Compute new route
    const route = await routingService.computeRoute({
      from: prevItem.location,
      to: item.location,
      mode,
    });

    // Update item's route
    await query(
      `UPDATE itinerary_items
       SET route_from_previous = $1, updated_at = NOW()
       WHERE id = $2 AND trip_id = $3`,
      [JSON.stringify(route), itemId, tripId]
    );

    // Recalculate item times if needed
    await this.recalculateItemTime(tripId, itemId, route.duration_minutes);

    logger.info('Item route updated', { tripId, itemId, mode, duration: route.duration_minutes });

    // Get updated item
    const updatedResult = await query(
      `SELECT * FROM itinerary_items WHERE id = $1 AND trip_id = $2`,
      [itemId, tripId]
    );

    return this.mapRowToItem(updatedResult.rows[0]);
  }

  /**
   * Update all routes in itinerary (recompute with current modes)
   */
  async updateAllRoutes(tripId: string): Promise<Itinerary> {
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    for (const day of itinerary.days) {
      for (let i = 1; i < day.items.length; i++) {
        const item = day.items[i];
        const prevItem = day.items[i - 1];

        if (!item.location || !prevItem.location) {
          continue;
        }

        // Get current route mode or default to walking
        const currentMode = item.route_from_previous?.mode || 'walking';

        // Compute route
        const route = await routingService.computeRoute({
          from: prevItem.location,
          to: item.location,
          mode: currentMode,
        });

        // Update route
        await query(
          `UPDATE itinerary_items
           SET route_from_previous = $1, updated_at = NOW()
           WHERE id = $2 AND trip_id = $3`,
          [JSON.stringify(route), item.id, tripId]
        );
      }
    }

    return await itineraryGeneratorService.getItineraryByTripId(tripId) as Itinerary;
  }

  /**
   * Recalculate item time based on route duration
   */
  private async recalculateItemTime(
    tripId: string,
    itemId: string,
    routeDurationMinutes: number
  ): Promise<void> {
    const itemResult = await query(
      `SELECT * FROM itinerary_items WHERE id = $1 AND trip_id = $2`,
      [itemId, tripId]
    );

    if (itemResult.rows.length === 0) {
      return;
    }

    const item = this.mapRowToItem(itemResult.rows[0]);

    // Get previous item end time
    const prevItemResult = await query(
      `SELECT * FROM itinerary_items
       WHERE trip_id = $1 AND day = $2 AND "order" < $3
       ORDER BY "order" DESC
       LIMIT 1`,
      [tripId, item.day, item.order]
    );

    if (prevItemResult.rows.length === 0) {
      return; // First item, no need to adjust
    }

    const prevItem = this.mapRowToItem(prevItemResult.rows[0]);

    // Calculate new start time (previous end + buffer + route duration)
    const bufferMinutes = 15;
    const newStartTime = this.addMinutes(
      prevItem.end_time,
      bufferMinutes + routeDurationMinutes
    );

    const newEndTime = this.addMinutes(newStartTime, item.duration_minutes);

    // Update item times
    await query(
      `UPDATE itinerary_items
       SET start_time = $1, end_time = $2, updated_at = NOW()
       WHERE id = $3 AND trip_id = $4`,
      [newStartTime, newEndTime, itemId, tripId]
    );
  }

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
}

export const itineraryRoutingService = new ItineraryRoutingService();

