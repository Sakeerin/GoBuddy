// Trip and itinerary types

export type TripStyle = 'city_break' | 'nature' | 'theme' | 'workation' | 'family';

export interface Trip {
  id: string;
  user_id?: string; // null for guest trips
  guest_session_id?: string; // for guest trips
  status: 'draft' | 'planning' | 'booked' | 'active' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export interface TripPreferences {
  trip_id: string;
  destination: {
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  dates: {
    start: Date;
    end: Date;
  };
  travelers: {
    adults: number;
    children: number;
    seniors: number;
  };
  budget: {
    total?: number;
    per_day?: number;
    currency: string;
  };
  style: TripStyle;
  daily_time_window: {
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  constraints: {
    max_walking_km_per_day?: number;
    has_children: boolean;
    has_seniors: boolean;
    needs_rest_time: boolean;
    avoid_crowds: boolean;
    risk_areas_to_avoid?: string[];
  };
  created_at: Date;
  updated_at: Date;
}

export interface CreateTripRequest {
  destination: TripPreferences['destination'];
  dates: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  travelers: TripPreferences['travelers'];
  budget: TripPreferences['budget'];
  style: TripStyle;
  daily_time_window: TripPreferences['daily_time_window'];
  constraints: TripPreferences['constraints'];
}

export interface UpdateTripRequest {
  destination?: Partial<TripPreferences['destination']>;
  dates?: {
    start?: string;
    end?: string;
  };
  travelers?: Partial<TripPreferences['travelers']>;
  budget?: Partial<TripPreferences['budget']>;
  style?: TripStyle;
  daily_time_window?: Partial<TripPreferences['daily_time_window']>;
  constraints?: Partial<TripPreferences['constraints']>;
}

