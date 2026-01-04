// Sharing and collaboration types

export type ShareRole = 'owner' | 'editor' | 'viewer';

export interface TripShare {
  id: string;
  trip_id: string;
  share_token: string;
  role: ShareRole;
  created_by: string; // user_id
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateShareRequest {
  role: ShareRole;
  expires_at?: string; // ISO date string
}

export interface ShareAccess {
  trip_id: string;
  role: ShareRole;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
}

export interface CollaborationInvite {
  id: string;
  trip_id: string;
  invited_by: string; // user_id
  invited_email: string;
  role: ShareRole;
  status: 'pending' | 'accepted' | 'declined';
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface Vote {
  id: string;
  trip_id: string;
  item_id?: string; // itinerary item or replan proposal
  voter_id: string; // user_id
  vote_type: 'activity' | 'replan_option';
  vote_value: 'up' | 'down' | 'neutral';
  created_at: Date;
}

export interface Comment {
  id: string;
  trip_id: string;
  item_id?: string; // itinerary item or day
  author_id: string; // user_id
  content: string;
  created_at: Date;
  updated_at: Date;
}

