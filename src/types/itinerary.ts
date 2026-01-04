// Itinerary types

export type ItineraryItemType = 'poi' | 'activity' | 'hotel' | 'transport' | 'meal' | 'free_time';

export interface RouteSegment {
  from_item_id?: string; // null for first item of the day
  to_item_id: string;
  mode: 'walking' | 'transit' | 'taxi' | 'drive';
  distance_km: number;
  duration_minutes: number;
  cost_estimate?: {
    amount: number;
    currency: string;
  };
  polyline?: string; // For map display
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  day: number; // Day number (1, 2, 3, ...)
  item_type: ItineraryItemType;
  poi_id?: string; // If type is 'poi' or 'activity'
  name: string;
  description?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  duration_minutes: number;
  is_pinned: boolean;
  order: number; // Order within the day
  route_from_previous?: RouteSegment;
  cost_estimate?: {
    amount: number;
    currency: string;
    confidence: 'fixed' | 'estimated';
  };
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ItineraryDay {
  day: number;
  date: string; // ISO date string
  items: ItineraryItem[];
  total_travel_time_minutes: number;
  total_cost_estimate: {
    amount: number;
    currency: string;
  };
}

export interface Itinerary {
  id: string;
  trip_id: string;
  days: ItineraryDay[];
  total_cost_estimate: {
    amount: number;
    currency: string;
  };
  generated_at: Date;
  version: number;
}

export interface GenerateItineraryRequest {
  selected_poi_ids: string[];
  optimize_budget?: boolean;
  regenerate_mode?: 'full' | 'incremental';
  preserve_pinned?: boolean;
}

export interface ItineraryGenerationResult {
  itinerary_id: string;
  days: ItineraryDay[];
  total_cost_estimate: {
    amount: number;
    currency: string;
  };
  warnings?: string[];
  generated_at: Date;
}

