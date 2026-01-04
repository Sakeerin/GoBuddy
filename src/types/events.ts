// Event monitoring types

export type EventType = 'weather' | 'closure' | 'sold_out' | 'delay' | 'availability_changed';
export type EventSeverity = 'low' | 'medium' | 'high';

export interface EventSignal {
  id: string;
  trip_id: string;
  event_type: EventType;
  severity: EventSeverity;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  time_slot: {
    start: string; // ISO datetime
    end: string; // ISO datetime
  };
  details: Record<string, unknown>;
  affected_items: string[]; // itinerary item IDs
  detected_at: Date;
  processed: boolean;
  replan_triggered: boolean;
}

export interface WeatherEventDetails {
  condition: string; // 'heavy_rain', 'light_rain', 'sunny', etc.
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  impact: string; // 'outdoor_activities_affected', etc.
}

export interface ClosureEventDetails {
  place_id: string;
  reason: string;
  alternative_suggestions?: string[];
}

export interface SoldOutEventDetails {
  item_id: string;
  date: string;
  alternative_slots?: Array<{
    date: string;
    time?: string;
  }>;
}

export interface DelayEventDetails {
  transport_type: string;
  original_time: string;
  new_time: string;
  delay_minutes: number;
}

export interface ReplanTrigger {
  id: string;
  trip_id: string;
  event_signal_id: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  created_at: Date;
  processed: boolean;
}

