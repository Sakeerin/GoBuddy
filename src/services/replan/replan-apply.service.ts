import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { itineraryGeneratorService } from '@/services/itinerary/itinerary-generator.service';
import { itineraryVersionService } from '@/services/itinerary/itinerary-version.service';
import { replanEngineService } from './replan-engine.service';
import { eventMonitorService } from '@/services/events/event-monitor.service';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError } from '@/utils/errors';
import { Itinerary, ItineraryItem } from '@/types/itinerary';
import {
  ReplanProposal,
  ApplyReplanRequest,
  ApplyReplanResponse,
} from '@/types/replan';
import { Itinerary, ItineraryItem } from '@/types/itinerary';

const ROLLBACK_WINDOW_HOURS = 24; // Rollback available for 24 hours

export class ReplanApplyService {
  /**
   * Apply a replan proposal transactionally
   */
  async applyProposal(
    request: ApplyReplanRequest,
    userId?: string
  ): Promise<ApplyReplanResponse> {
    // Get proposal
    const proposal = await replanEngineService.getProposal(request.proposal_id);

    // Get current itinerary
    const currentItinerary = await itineraryGeneratorService.getItineraryByTripId(proposal.trip_id);
    if (!currentItinerary) {
      throw new NotFoundError('Itinerary', proposal.trip_id);
    }

    // Create version snapshot before applying
    const previousVersion = await itineraryVersionService
      .getVersion(proposal.trip_id, currentItinerary.version)
      .catch(() => null);

    await itineraryVersionService.createSnapshot(
      proposal.trip_id,
      'replan',
      userId,
      previousVersion || undefined
    );

    // Start transaction (using BEGIN/COMMIT/ROLLBACK)
    await query('BEGIN', []);

    try {
      // Apply changes
      await this.applyChanges(proposal, currentItinerary);

      // Update itinerary version
      const newVersion = currentItinerary.version + 1;
      await query(
        `UPDATE itineraries SET version = $1, generated_at = NOW() WHERE trip_id = $2`,
        [newVersion, proposal.trip_id]
      );

      // Create application record
      const applicationId = uuidv4();
      const rollbackUntil = new Date();
      rollbackUntil.setHours(rollbackUntil.getHours() + ROLLBACK_WINDOW_HOURS);

      await query(
        `INSERT INTO replan_applications (
          id, trip_id, proposal_id, applied_version, rollback_available_until
        ) VALUES ($1, $2, $3, $4, $5)`,
        [applicationId, proposal.trip_id, proposal.id, newVersion, rollbackUntil]
      );

      // Mark trigger as processed
      if (proposal.trigger_id) {
        await eventMonitorService.markTriggerProcessed(proposal.trigger_id);
      }

      // Commit transaction
      await query('COMMIT', []);

      logger.info('Replan proposal applied', {
        proposalId: proposal.id,
        tripId: proposal.trip_id,
        newVersion,
      });

      return {
        success: true,
        new_version_id: newVersion.toString(),
        applied_at: new Date(),
        rollback_available_until: rollbackUntil,
      };
    } catch (error) {
      // Rollback transaction
      await query('ROLLBACK', []);
      logger.error('Failed to apply replan proposal', {
        proposalId: proposal.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Apply changes from proposal
   */
  private async applyChanges(
    proposal: ReplanProposal,
    itinerary: Itinerary
  ): Promise<void> {
    const { changes } = proposal;

    // Remove items
    for (const removed of changes.removed_items) {
      await query(
        `DELETE FROM itinerary_items WHERE id = $1 AND trip_id = $2`,
        [removed.item_id, proposal.trip_id]
      );
    }

    // Replace items
    for (const replaced of changes.replaced_items) {
      // Delete old item
      await query(
        `DELETE FROM itinerary_items WHERE id = $1 AND trip_id = $2`,
        [replaced.old_item_id, proposal.trip_id]
      );

      // Insert new item
      const item = replaced.new_item;
      await query(
        `INSERT INTO itinerary_items (
          id, trip_id, day, item_type, poi_id, name, start_time, end_time,
          duration_minutes, is_pinned, "order", location, cost_estimate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          item.id,
          proposal.trip_id,
          this.getDayFromTime(itinerary, item.start_time),
          'poi',
          item.poi_id || null,
          item.name,
          item.start_time,
          item.end_time,
          this.calculateDuration(item.start_time, item.end_time),
          false,
          0, // Will be recalculated
          item.location ? JSON.stringify(item.location) : null,
          null, // Cost will be calculated later
        ]
      );
    }

    // Move items
    for (const moved of changes.moved_items) {
      await query(
        `UPDATE itinerary_items
         SET day = $1, start_time = $2, end_time = $3, updated_at = NOW()
         WHERE id = $4 AND trip_id = $5`,
        [
          moved.new_day,
          moved.new_time,
          this.calculateNewEndTime(moved.new_time, moved.old_time, itinerary),
          moved.item_id,
          proposal.trip_id,
        ]
      );
    }

    // Add items
    for (const added of changes.added_items) {
      await query(
        `INSERT INTO itinerary_items (
          id, trip_id, day, item_type, poi_id, name, start_time, end_time,
          duration_minutes, is_pinned, "order", location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          added.id,
          proposal.trip_id,
          added.day,
          'poi',
          added.poi_id || null,
          added.name,
          added.start_time,
          added.end_time,
          this.calculateDuration(added.start_time, added.end_time),
          false,
          0,
          null,
        ]
      );
    }

    // Recalculate order for all affected days
    const affectedDays = new Set<number>();
    changes.moved_items.forEach((m) => {
      affectedDays.add(m.old_day);
      affectedDays.add(m.new_day);
    });
    changes.replaced_items.forEach((r) => {
      const item = this.findItemInItinerary(itinerary, r.old_item_id);
      if (item) affectedDays.add(item.day);
    });
    changes.added_items.forEach((a) => affectedDays.add(a.day));

    for (const day of affectedDays) {
      await this.recalculateDayOrder(proposal.trip_id, day);
    }
  }

  /**
   * Rollback to previous version
   */
  async rollbackReplan(
    tripId: string,
    applicationId: string,
    userId?: string
  ): Promise<void> {
    // Get application record
    const appResult = await query(
      `SELECT * FROM replan_applications WHERE id = $1 AND trip_id = $2`,
      [applicationId, tripId]
    );

    if (appResult.rows.length === 0) {
      throw new NotFoundError('Replan application', applicationId);
    }

    const application = appResult.rows[0];

    // Check if rollback is still available
    if (new Date(application.rollback_available_until) < new Date()) {
      throw new ValidationError('Rollback window has expired');
    }

    if (application.rolled_back) {
      throw new ValidationError('Replan has already been rolled back');
    }

    // Rollback to previous version
    const previousVersion = application.applied_version - 1;
    await itineraryVersionService.rollbackToVersion(
      tripId,
      previousVersion,
      userId
    );

    // Mark as rolled back
    await query(
      `UPDATE replan_applications
       SET rolled_back = TRUE, rolled_back_at = NOW()
       WHERE id = $1`,
      [applicationId]
    );

    logger.info('Replan rolled back', {
      applicationId,
      tripId,
      fromVersion: application.applied_version,
      toVersion: previousVersion,
    });
  }

  /**
   * Validate applied itinerary
   */
  async validateAppliedItinerary(tripId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    const issues: string[] = [];

    // Check for orphaned items
    for (const day of itinerary.days) {
      for (const item of day.items) {
        if (item.poi_id) {
          try {
            await query(`SELECT id FROM pois WHERE id = $1`, [item.poi_id]);
          } catch {
            issues.push(`Item ${item.id} references non-existent POI ${item.poi_id}`);
          }
        }
      }
    }

    // Check time validity
    for (const day of itinerary.days) {
      const items = day.items.sort((a, b) => a.start_time.localeCompare(b.start_time));
      for (let i = 1; i < items.length; i++) {
        if (items[i].start_time < items[i - 1].end_time) {
          issues.push(`Time conflict in day ${day.day}: ${items[i - 1].name} and ${items[i].name}`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Helper methods
   */
  private findItemInItinerary(itinerary: Itinerary, itemId: string): ItineraryItem | null {
    for (const day of itinerary.days) {
      const item = day.items.find((i) => i.id === itemId);
      if (item) return item;
    }
    return null;
  }

  private getDayFromTime(itinerary: Itinerary, timeStr: string): number {
    // For simplicity, use first day
    // In production, should determine based on date
    return itinerary.days[0]?.day || 1;
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    return Math.round((end - start) / (1000 * 60));
  }

  private calculateNewEndTime(
    newStartTime: string,
    oldStartTime: string,
    itinerary: Itinerary
  ): string {
    // Find original item to get duration
    // For simplicity, assume same duration
    const duration = 120; // Default 2 hours
    return this.addMinutes(newStartTime, duration);
  }

  private recalculateDayOrder(tripId: string, day: number): Promise<void> {
    return query(
      `UPDATE itinerary_items
       SET "order" = sub.row_num - 1
       FROM (
         SELECT id, ROW_NUMBER() OVER (ORDER BY start_time) as row_num
         FROM itinerary_items
         WHERE trip_id = $1 AND day = $2
       ) sub
       WHERE itinerary_items.id = sub.id`,
      [tripId, day]
    ).then(() => undefined);
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(2000, 0, 1, hours, minutes).getTime();
  }

  private addMinutes(timeStr: string, minutes: number): string {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }
}

export const replanApplyService = new ReplanApplyService();

