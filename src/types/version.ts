// Versioning types

export type ChangeType = 'generate' | 'edit' | 'reorder' | 'add' | 'remove' | 'pin' | 'unpin' | 'time_change';

export interface ItineraryVersion {
  id: string;
  trip_id: string;
  version: number;
  change_type: ChangeType;
  changed_by?: string; // user_id or guest_session_id
  snapshot: {
    days: any[]; // ItineraryDay structure
    total_cost_estimate: {
      amount: number;
      currency: string;
    };
  };
  diff?: VersionDiff;
  created_at: Date;
}

export interface VersionDiff {
  added_items: string[]; // item IDs
  removed_items: string[]; // item IDs
  moved_items: Array<{
    item_id: string;
    old_day: number;
    new_day: number;
    old_order: number;
    new_order: number;
  }>;
  modified_items: Array<{
    item_id: string;
    changes: {
      field: string;
      old_value: any;
      new_value: any;
    }[];
  }>;
}

export interface VersionHistory {
  versions: ItineraryVersion[];
  current_version: number;
  total_versions: number;
}

