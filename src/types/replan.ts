// Replanning types

export interface ReplanProposal {
  id: string;
  trip_id: string;
  trigger_id: string;
  score: number; // Quality score 0-1
  explanation: string;
  changes: ProposalChanges;
  impact: ProposalImpact;
  created_at: Date;
}

export interface ProposalChanges {
  replaced_items: Array<{
    old_item_id: string;
    old_item_name: string;
    new_item: {
      id: string;
      name: string;
      poi_id?: string;
      start_time: string;
      end_time: string;
      location?: {
        lat: number;
        lng: number;
      };
    };
  }>;
  moved_items: Array<{
    item_id: string;
    old_day: number;
    new_day: number;
    old_time: string;
    new_time: string;
  }>;
  removed_items: Array<{
    item_id: string;
    name: string;
    reason: string;
  }>;
  added_items: Array<{
    id: string;
    name: string;
    poi_id?: string;
    day: number;
    start_time: string;
    end_time: string;
  }>;
}

export interface ProposalImpact {
  time_change_minutes: number; // Positive = more time, negative = less time
  cost_change: {
    amount: number; // Positive = more expensive, negative = cheaper
    currency: string;
  };
  distance_change_km: number; // Positive = more distance, negative = less distance
  disruption_score: number; // 0-1, higher = more disruptive
}

export interface ApplyReplanRequest {
  proposal_id: string;
  idempotency_key: string;
}

export interface ApplyReplanResponse {
  success: boolean;
  new_version_id: string;
  applied_at: Date;
  rollback_available_until: Date;
}

