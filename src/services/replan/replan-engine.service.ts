import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { itineraryGeneratorService } from '@/services/itinerary/itinerary-generator.service';
import { poiService } from '@/services/poi/poi.service';
import { eventMonitorService } from '@/services/events/event-monitor.service';
import { tripService } from '@/services/trip/trip.service';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError } from '@/utils/errors';
import {
  ReplanProposal,
  ProposalChanges,
  ProposalImpact,
} from '@/types/replan';
import { ReplanTrigger } from '@/types/events';
import { Itinerary, ItineraryItem, ItineraryDay } from '@/types/itinerary';
import { POI } from '@/types/poi';
import { TripPreferences } from '@/types/trip';

export class ReplanEngineService {
  /**
   * Generate replan proposals for a trigger
   */
  async generateProposals(
    triggerId: string,
    maxProposals: number = 3
  ): Promise<ReplanProposal[]> {
    const trigger = await eventMonitorService.getPendingReplanTriggers().then(
      (triggers) => triggers.find((t) => t.id === triggerId)
    );

    if (!trigger) {
      throw new NotFoundError('Replan trigger', triggerId);
    }

    // Get current itinerary
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(trigger.trip_id);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', trigger.trip_id);
    }

    // Get event signal
    const eventSignal = await eventMonitorService.getEventSignalById(trigger.event_signal_id);

    // Get trip preferences
    const { preferences } = await tripService.getTripWithPreferences(trigger.trip_id);

    // Generate proposals based on event type
    const proposals: ReplanProposal[] = [];

    if (eventSignal.event_type === 'weather' && eventSignal.severity === 'high') {
      // Generate weather-based proposals
      const weatherProposals = await this.generateWeatherProposals(
        itinerary,
        eventSignal,
        preferences,
        maxProposals
      );
      proposals.push(...weatherProposals);
    } else if (eventSignal.event_type === 'closure') {
      // Generate closure-based proposals
      const closureProposals = await this.generateClosureProposals(
        itinerary,
        eventSignal,
        preferences,
        maxProposals
      );
      proposals.push(...closureProposals);
    }

    // Sort by score (highest first)
    proposals.sort((a, b) => b.score - a.score);

    // Save proposals with trigger ID
    for (const proposal of proposals) {
      proposal.trigger_id = triggerId;
      await this.saveProposal(proposal);
    }

    return proposals.slice(0, maxProposals);
  }

  /**
   * Generate proposals for weather events
   */
  private async generateWeatherProposals(
    itinerary: Itinerary,
    eventSignal: any,
    preferences: TripPreferences,
    maxProposals: number
  ): Promise<ReplanProposal[]> {
    const proposals: ReplanProposal[] = [];
    const affectedItems = eventSignal.affected_items || [];

    if (affectedItems.length === 0) {
      return proposals;
    }

    // Strategy 1: Replace outdoor activities with indoor alternatives
    const proposal1 = await this.createReplaceOutdoorWithIndoorProposal(
      itinerary,
      affectedItems,
      preferences
    );
    if (proposal1) {
      proposals.push(proposal1);
    }

    // Strategy 2: Move affected activities to different day
    const proposal2 = await this.createMoveToDifferentDayProposal(
      itinerary,
      affectedItems,
      preferences
    );
    if (proposal2) {
      proposals.push(proposal2);
    }

    // Strategy 3: Remove affected activities and add buffer time
    const proposal3 = await this.createRemoveAndBufferProposal(
      itinerary,
      affectedItems,
      preferences
    );
    if (proposal3) {
      proposals.push(proposal3);
    }

    return proposals;
  }

  /**
   * Generate proposals for closure events
   */
  private async generateClosureProposals(
    itinerary: Itinerary,
    eventSignal: any,
    preferences: TripPreferences,
    maxProposals: number
  ): Promise<ReplanProposal[]> {
    const proposals: ReplanProposal[] = [];
    const affectedItems = eventSignal.affected_items || [];

    if (affectedItems.length === 0) {
      return proposals;
    }

    // Strategy 1: Replace with similar POI
    const proposal1 = await this.createReplaceWithSimilarProposal(
      itinerary,
      affectedItems,
      preferences
    );
    if (proposal1) {
      proposals.push(proposal1);
    }

    // Strategy 2: Move to different time slot
    const proposal2 = await this.createMoveTimeSlotProposal(
      itinerary,
      affectedItems,
      preferences
    );
    if (proposal2) {
      proposals.push(proposal2);
    }

    return proposals;
  }

  /**
   * Create proposal: Replace outdoor with indoor
   */
  private async createReplaceOutdoorWithIndoorProposal(
    itinerary: Itinerary,
    affectedItemIds: string[],
    preferences: TripPreferences
  ): Promise<ReplanProposal | null> {
    const changes: ProposalChanges = {
      replaced_items: [],
      moved_items: [],
      removed_items: [],
      added_items: [],
    };

    let totalCostChange = 0;
    let totalTimeChange = 0;

    for (const itemId of affectedItemIds) {
      const item = this.findItemInItinerary(itinerary, itemId);
      if (!item || item.is_pinned) continue; // Skip pinned items

      // Find indoor alternatives nearby
      const alternatives = await poiService.search({
        location: item.location,
        radius_km: 3,
        tags: ['indoor'],
        page: 1,
        per_page: 5,
      });

      if (alternatives.pois.length > 0) {
        const alternative = alternatives.pois[0];
        const oldCost = item.cost_estimate?.amount || 0;
        const newCost = alternative.price_range
          ? (alternative.price_range.min + alternative.price_range.max) / 2
          : 0;

        changes.replaced_items.push({
          old_item_id: item.id,
          old_item_name: item.name,
          new_item: {
            id: uuidv4(),
            name: alternative.name,
            poi_id: alternative.id,
            start_time: item.start_time,
            end_time: this.addMinutes(item.start_time, alternative.avg_duration_minutes),
            location: alternative.location,
          },
        });

        totalCostChange += newCost - oldCost;
        totalTimeChange += alternative.avg_duration_minutes - item.duration_minutes;
      }
    }

    if (changes.replaced_items.length === 0) {
      return null;
    }

    const impact = this.calculateImpact(changes, totalTimeChange, totalCostChange, preferences.budget.currency);
    const score = this.calculateScore(changes, impact);

    return {
      id: uuidv4(),
      trip_id: itinerary.trip_id,
      trigger_id: '', // Will be set by caller
      score,
      explanation: `Replace ${changes.replaced_items.length} outdoor activity(ies) with indoor alternatives`,
      changes,
      impact,
      created_at: new Date(),
    };
  }

  /**
   * Create proposal: Move to different day
   */
  private async createMoveToDifferentDayProposal(
    itinerary: Itinerary,
    affectedItemIds: string[],
    preferences: TripPreferences
  ): Promise<ReplanProposal | null> {
    const changes: ProposalChanges = {
      replaced_items: [],
      moved_items: [],
      removed_items: [],
      added_items: [],
    };

    for (const itemId of affectedItemIds) {
      const item = this.findItemInItinerary(itinerary, itemId);
      if (!item || item.is_pinned) continue;

      // Find a different day with available time
      const targetDay = this.findAvailableDay(itinerary, item.day, item.duration_minutes);
      if (targetDay) {
        changes.moved_items.push({
          item_id: item.id,
          old_day: item.day,
          new_day: targetDay.day,
          old_time: item.start_time,
          new_time: targetDay.availableTime,
        });
      }
    }

    if (changes.moved_items.length === 0) {
      return null;
    }

    const impact = this.calculateImpact(changes, 0, 0, preferences.budget.currency);
    const score = this.calculateScore(changes, impact);

    return {
      id: uuidv4(),
      trip_id: itinerary.trip_id,
      trigger_id: '',
      score,
      explanation: `Move ${changes.moved_items.length} activity(ies) to different day(s)`,
      changes,
      impact,
      created_at: new Date(),
    };
  }

  /**
   * Create proposal: Remove and add buffer
   */
  private async createRemoveAndBufferProposal(
    itinerary: Itinerary,
    affectedItemIds: string[],
    preferences: TripPreferences
  ): Promise<ReplanProposal | null> {
    const changes: ProposalChanges = {
      replaced_items: [],
      moved_items: [],
      removed_items: [],
      added_items: [],
    };

    let totalCostChange = 0;

    for (const itemId of affectedItemIds) {
      const item = this.findItemInItinerary(itinerary, itemId);
      if (!item || item.is_pinned) continue;

      changes.removed_items.push({
        item_id: item.id,
        name: item.name,
        reason: 'Weather conditions make this activity unsuitable',
      });

      totalCostChange -= item.cost_estimate?.amount || 0;
    }

    if (changes.removed_items.length === 0) {
      return null;
    }

    const impact = this.calculateImpact(changes, 0, totalCostChange, preferences.budget.currency);
    const score = this.calculateScore(changes, impact);

    return {
      id: uuidv4(),
      trip_id: itinerary.trip_id,
      trigger_id: '',
      score,
      explanation: `Remove ${changes.removed_items.length} affected activity(ies)`,
      changes,
      impact,
      created_at: new Date(),
    };
  }

  /**
   * Create proposal: Replace with similar POI
   */
  private async createReplaceWithSimilarProposal(
    itinerary: Itinerary,
    affectedItemIds: string[],
    preferences: TripPreferences
  ): Promise<ReplanProposal | null> {
    // Similar to replace outdoor with indoor, but find similar POIs
    return this.createReplaceOutdoorWithIndoorProposal(itinerary, affectedItemIds, preferences);
  }

  /**
   * Create proposal: Move time slot
   */
  private async createMoveTimeSlotProposal(
    itinerary: Itinerary,
    affectedItemIds: string[],
    preferences: TripPreferences
  ): Promise<ReplanProposal | null> {
    const changes: ProposalChanges = {
      replaced_items: [],
      moved_items: [],
      removed_items: [],
      added_items: [],
    };

    for (const itemId of affectedItemIds) {
      const item = this.findItemInItinerary(itinerary, itemId);
      if (!item || item.is_pinned) continue;

      // Try to move to later in the same day
      const newTime = this.findAvailableTimeSlot(itinerary, item.day, item.duration_minutes, item.end_time);
      if (newTime) {
        changes.moved_items.push({
          item_id: item.id,
          old_day: item.day,
          new_day: item.day,
          old_time: item.start_time,
          new_time: newTime,
        });
      }
    }

    if (changes.moved_items.length === 0) {
      return null;
    }

    const impact = this.calculateImpact(changes, 0, 0, preferences.budget.currency);
    const score = this.calculateScore(changes, impact);

    return {
      id: uuidv4(),
      trip_id: itinerary.trip_id,
      trigger_id: '',
      score,
      explanation: `Move ${changes.moved_items.length} activity(ies) to different time slot`,
      changes,
      impact,
      created_at: new Date(),
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

  private findAvailableDay(
    itinerary: Itinerary,
    excludeDay: number,
    durationMinutes: number
  ): { day: number; availableTime: string } | null {
    for (const day of itinerary.days) {
      if (day.day === excludeDay) continue;

      // Find available time slot
      const availableTime = this.findAvailableTimeSlot(itinerary, day.day, durationMinutes);
      if (availableTime) {
        return { day: day.day, availableTime };
      }
    }
    return null;
  }

  private findAvailableTimeSlot(
    itinerary: Itinerary,
    day: number,
    durationMinutes: number,
    afterTime?: string
  ): string | null {
    const dayData = itinerary.days.find((d) => d.day === day);
    if (!dayData) return null;

    const items = dayData.items.sort((a, b) => a.start_time.localeCompare(b.start_time));
    const timeWindow = { start: '09:00', end: '20:00' }; // Default, should come from preferences

    let currentTime = afterTime || timeWindow.start;

    for (const item of items) {
      if (item.is_pinned) continue;

      const itemStart = this.parseTime(item.start_time);
      const current = this.parseTime(currentTime);

      if (current + durationMinutes * 60 * 1000 <= itemStart) {
        return currentTime;
      }

      currentTime = this.addMinutes(item.end_time, 15); // 15 min buffer
    }

    // Check if there's time after last item
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      const lastEnd = this.parseTime(lastItem.end_time);
      const timeWindowEnd = this.parseTime(timeWindow.end);

      if (lastEnd + durationMinutes * 60 * 1000 <= timeWindowEnd) {
        return this.formatTime(new Date(lastEnd + 15 * 60 * 1000));
      }
    }

    return null;
  }

  private calculateImpact(
    changes: ProposalChanges,
    timeChange: number,
    costChange: number,
    currency: string
  ): ProposalImpact {
    const disruptionScore = this.calculateDisruptionScore(changes);

    return {
      time_change_minutes: timeChange,
      cost_change: {
        amount: costChange,
        currency,
      },
      distance_change_km: 0, // TODO: Calculate actual distance change
      disruption_score: disruptionScore,
    };
  }

  private calculateDisruptionScore(changes: ProposalChanges): number {
    // Higher score = more disruptive
    let score = 0;

    score += changes.replaced_items.length * 0.3;
    score += changes.moved_items.length * 0.2;
    score += changes.removed_items.length * 0.4;
    score += changes.added_items.length * 0.1;

    return Math.min(score, 1.0);
  }

  private calculateScore(changes: ProposalChanges, impact: ProposalImpact): number {
    // Higher score = better proposal
    let score = 1.0;

    // Penalize disruption
    score -= impact.disruption_score * 0.5;

    // Reward cost savings
    if (impact.cost_change.amount < 0) {
      score += 0.2;
    } else if (impact.cost_change.amount > 0) {
      score -= 0.1;
    }

    // Penalize time changes
    if (Math.abs(impact.time_change_minutes) > 60) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private addMinutes(timeStr: string, minutes: number): string {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(2000, 0, 1, hours, minutes).getTime();
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * Save proposal to database
   */
  private async saveProposal(proposal: ReplanProposal): Promise<void> {
    await query(
      `INSERT INTO replan_proposals (
        id, trip_id, trigger_id, score, explanation, changes, impact
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        proposal.id,
        proposal.trip_id,
        proposal.trigger_id,
        proposal.score,
        proposal.explanation,
        JSON.stringify(proposal.changes),
        JSON.stringify(proposal.impact),
      ]
    );
  }

  /**
   * Get proposal by ID
   */
  async getProposal(proposalId: string): Promise<ReplanProposal> {
    const result = await query(
      `SELECT * FROM replan_proposals WHERE id = $1`,
      [proposalId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Replan proposal', proposalId);
    }

    return this.mapRowToProposal(result.rows[0]);
  }

  /**
   * Get proposals for a trigger
   */
  async getProposalsForTrigger(triggerId: string): Promise<ReplanProposal[]> {
    const result = await query(
      `SELECT * FROM replan_proposals WHERE trigger_id = $1 ORDER BY score DESC`,
      [triggerId]
    );

    return result.rows.map((row) => this.mapRowToProposal(row));
  }

  private mapRowToProposal(row: any): ReplanProposal {
    return {
      id: row.id,
      trip_id: row.trip_id,
      trigger_id: row.trigger_id,
      score: parseFloat(row.score),
      explanation: row.explanation,
      changes: typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes,
      impact: typeof row.impact === 'string' ? JSON.parse(row.impact) : row.impact,
      created_at: row.created_at,
    };
  }
}

export const replanEngineService = new ReplanEngineService();

