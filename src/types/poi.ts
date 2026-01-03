// POI (Point of Interest) types

export interface POI {
  id: string;
  place_id: string; // External provider ID (e.g., Google Places ID)
  name: string;
  description?: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  hours?: {
    [day: string]: {
      open: string; // HH:mm format
      close: string; // HH:mm format
      closed?: boolean;
    };
  };
  tags: string[]; // Categories and attributes
  avg_duration_minutes: number;
  price_range?: {
    min: number;
    max: number;
    currency: string;
  };
  rating?: number;
  rating_count?: number;
  images?: string[];
  website_url?: string;
  phone?: string;
  provider: string; // e.g., 'google_places', 'foursquare'
  created_at: Date;
  updated_at: Date;
}

export interface POISearchFilters {
  q?: string; // Query text
  location?: {
    lat: number;
    lng: number;
    radius_km?: number;
  };
  tags?: string[]; // Filter by tags
  budget_range?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  open_now?: boolean;
  kid_friendly?: boolean;
  page?: number;
  per_page?: number;
}

export interface POISearchResult {
  pois: POI[];
  total: number;
  page: number;
  per_page: number;
}

