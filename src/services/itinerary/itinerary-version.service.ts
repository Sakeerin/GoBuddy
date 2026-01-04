import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { itineraryGeneratorService } from './itinerary-generator.service';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError } from '@/utils/errors';
import {
  Itinerary,
  ItineraryItem,
  ItineraryDay,
} from '@/types/itinerary';
import {
  ItineraryVersion,
  VersionDiff,
  VersionHistory,
  ChangeType,
} from '@/types/version';

export class ItineraryVersionService {
  /**
   * Create a snapshot of current itinerary
   */
  async createSnapshot(
    tripId: string,
    changeType: ChangeType,
    changedBy?: string,
    previousVersion?: ItineraryVersion
  ): Promise<ItineraryVersion> {
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    // Calculate diff if previous version exists
    let diff: VersionDiff | undefined;
    if (previousVersion) {
      diff = this.calculateDiff(previousVersion.snapshot, itinerary);
    }

    // Create version record
    const versionId = uuidv4();
    await query(
      `INSERT INTO itinerary_versions (
        id, trip_id, version, change_type, changed_by, snapshot, diff
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        versionId,
        tripId,
        itinerary.version,
        changeType,
        changedBy || null,
        JSON.stringify({
          days: itinerary.days,
          total_cost_estimate: itinerary.total_cost_estimate,
        }),
        diff ? JSON.stringify(diff) : null,
      ]
    );

    logger.info('Itinerary snapshot created', {
      tripId,
      version: itinerary.version,
      changeType,
    });

    return {
      id: versionId,
      trip_id: tripId,
      version: itinerary.version,
      change_type: changeType,
      changed_by: changedBy,
      snapshot: {
        days: itinerary.days,
        total_cost_estimate: itinerary.total_cost_estimate,
      },
      diff,
      created_at: new Date(),
    };
  }

  /**
   * Get version history for a trip
   */
  async getVersionHistory(tripId: string): Promise<VersionHistory> {
    const result = await query(
      `SELECT * FROM itinerary_versions
       WHERE trip_id = $1
       ORDER BY version DESC`,
      [tripId]
    );

    const versions = result.rows.map((row) => this.mapRowToVersion(row));

    // Get current version
    const currentItinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    const currentVersion = currentItinerary?.version || 0;

    return {
      versions,
      current_version: currentVersion,
      total_versions: versions.length,
    };
  }

  /**
   * Get a specific version
   */
  async getVersion(tripId: string, version: number): Promise<ItineraryVersion> {
    const result = await query(
      `SELECT * FROM itinerary_versions
       WHERE trip_id = $1 AND version = $2`,
      [tripId, version]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Itinerary version', `${tripId}-v${version}`);
    }

    return this.mapRowToVersion(result.rows[0]);
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    tripId: string,
    version1: number,
    version2: number
  ): Promise<VersionDiff> {
    const v1 = await this.getVersion(tripId, version1);
    const v2 = await this.getVersion(tripId, version2);

    return this.calculateDiff(v1.snapshot, {
      days: v2.snapshot.days,
      total_cost_estimate: v2.snapshot.total_cost_estimate,
    });
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(
    tripId: string,
    targetVersion: number,
    userId?: string,
    guestSessionId?: string
  ): Promise<Itinerary> {
    // Get target version
    const target = await this.getVersion(tripId, targetVersion);

    // Get current itinerary
    const current = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!current) {
      throw new NotFoundError('Itinerary', tripId);
    }

    if (target.version >= current.version) {
      throw new ValidationError('Cannot rollback to current or future version');
    }

    // Delete current items
    await query(
      `DELETE FROM itinerary_items WHERE trip_id = $1`,
      [tripId]
    );

    // Restore items from snapshot
    const days = target.snapshot.days as ItineraryDay[];
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

    // Update itinerary version
    await query(
      `UPDATE itineraries
       SET version = $1, generated_at = NOW()
       WHERE trip_id = $2`,
      [target.version, tripId]
    );

    // Create new snapshot for rollback
    await this.createSnapshot(
      tripId,
      'edit',
      userId || guestSessionId
    );

    logger.info('Itinerary rolled back', {
      tripId,
      fromVersion: current.version,
      toVersion: target.version,
    });

    return await itineraryGeneratorService.getItineraryByTripId(tripId) as Itinerary;
  }

  /**
   * Calculate diff between two itinerary snapshots
   */
  private calculateDiff(
    oldSnapshot: { days: ItineraryDay[] },
    newSnapshot: { days: ItineraryDay[] }
  ): VersionDiff {
    const oldItems = new Map<string, ItineraryItem>();
    const newItems = new Map<string, ItineraryItem>();

    // Collect old items
    for (const day of oldSnapshot.days) {
      for (const item of day.items) {
        oldItems.set(item.id, item);
      }
    }

    // Collect new items
    for (const day of newSnapshot.days) {
      for (const item of day.items) {
        newItems.set(item.id, item);
      }
    }

    const addedItems: string[] = [];
    const removedItems: string[] = [];
    const movedItems: Array<{
      item_id: string;
      old_day: number;
      new_day: number;
      old_order: number;
      new_order: number;
    }> = [];
    const modifiedItems: Array<{
      item_id: string;
      changes: Array<{
        field: string;
        old_value: any;
        new_value: any;
      }>;
    }> = [];

    // Find added items
    for (const [itemId, item] of newItems.entries()) {
      if (!oldItems.has(itemId)) {
        addedItems.push(itemId);
      }
    }

    // Find removed items
    for (const [itemId, item] of oldItems.entries()) {
      if (!newItems.has(itemId)) {
        removedItems.push(itemId);
      }
    }

    // Find moved and modified items
    for (const [itemId, newItem] of newItems.entries()) {
      const oldItem = oldItems.get(itemId);
      if (!oldItem) continue;

      // Check if moved
      if (oldItem.day !== newItem.day || oldItem.order !== newItem.order) {
        movedItems.push({
          item_id: itemId,
          old_day: oldItem.day,
          new_day: newItem.day,
          old_order: oldItem.order,
          new_order: newItem.order,
        });
      }

      // Check for modifications
      const changes: Array<{ field: string; old_value: any; new_value: any }> = [];

      if (oldItem.start_time !== newItem.start_time) {
        changes.push({
          field: 'start_time',
          old_value: oldItem.start_time,
          new_value: newItem.start_time,
        });
      }

      if (oldItem.end_time !== newItem.end_time) {
        changes.push({
          field: 'end_time',
          old_value: oldItem.end_time,
          new_value: newItem.end_time,
        });
      }

      if (oldItem.is_pinned !== newItem.is_pinned) {
        changes.push({
          field: 'is_pinned',
          old_value: oldItem.is_pinned,
          new_value: newItem.is_pinned,
        });
      }

      if (oldItem.notes !== newItem.notes) {
        changes.push({
          field: 'notes',
          old_value: oldItem.notes,
          new_value: newItem.notes,
        });
      }

      if (changes.length > 0) {
        modifiedItems.push({
          item_id: itemId,
          changes,
        });
      }
    }

    return {
      added_items: addedItems,
      removed_items: removedItems,
      moved_items: movedItems,
      modified_items: modifiedItems,
    };
  }

  private mapRowToVersion(row: any): ItineraryVersion {
    return {
      id: row.id,
      trip_id: row.trip_id,
      version: row.version,
      change_type: row.change_type,
      changed_by: row.changed_by,
      snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
      diff: row.diff ? (typeof row.diff === 'string' ? JSON.parse(row.diff) : row.diff) : undefined,
      created_at: row.created_at,
    };
  }
}

export const itineraryVersionService = new ItineraryVersionService();

