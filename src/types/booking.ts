// Booking types

export type BookingStatus = 'pending' | 'confirmed' | 'failed' | 'canceled' | 'refunded';

export type ProviderType = 'activity' | 'hotel' | 'transport';

export interface Booking {
  id: string;
  trip_id: string;
  itinerary_item_id?: string; // Linked to itinerary item
  provider_id: string;
  provider_type: ProviderType;
  external_booking_id: string; // Provider's booking ID
  status: BookingStatus;
  price: {
    amount: number;
    currency: string;
  };
  policies: {
    cancellation: string;
    refund: string;
    cancellation_deadline?: string; // ISO date string
  };
  voucher_url?: string;
  voucher_data?: string; // Base64 encoded voucher
  confirmation_number: string;
  traveler_details: {
    adults: number;
    children?: number;
    seniors?: number;
  };
  booking_date: string; // ISO date string
  booking_time?: string; // For activities
  contact_info: {
    email: string;
    phone?: string;
    name: string;
  };
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface BookingStateHistory {
  id: string;
  booking_id: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  reason?: string;
  changed_by?: string; // user_id or system
  created_at: Date;
}

export interface CreateBookingRequest {
  itinerary_item_id?: string;
  provider_id: string;
  provider_option_id: string; // External provider option ID
  traveler_details: {
    adults: number;
    children?: number;
    seniors?: number;
  };
  contact_info: {
    email: string;
    phone?: string;
    name: string;
  };
  booking_date: string;
  booking_time?: string;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
}

export interface BookingSearchOptions {
  location?: {
    lat: number;
    lng: number;
    radius_km?: number;
  };
  category?: string;
  date?: string;
  travelers?: {
    adults: number;
    children?: number;
  };
  price_range?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

export interface BookingOption {
  id: string; // Provider option ID
  name: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
  };
  availability: {
    available: boolean;
    slots?: Array<{
      time: string;
      available: boolean;
    }>;
  };
  policies: {
    cancellation: string;
    refund: string;
  };
  provider: string;
}

