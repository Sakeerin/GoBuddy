// Provider adapter interface

export interface SearchOptions {
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

export interface SearchResult {
  id: string; // Provider item ID
  name: string;
  description?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  price: {
    amount: number;
    currency: string;
  };
  rating?: number;
  images?: string[];
}

export interface ItemDetails {
  id: string;
  name: string;
  description?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
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
  images?: string[];
  rating?: number;
}

export interface TravelerCount {
  adults: number;
  children?: number;
  seniors?: number;
}

export interface Availability {
  available: boolean;
  slots?: Array<{
    time: string;
    available: boolean;
    price?: {
      amount: number;
      currency: string;
    };
  }>;
}

export interface BookingRequest {
  provider_item_id: string;
  date: string;
  time_slot?: string;
  travelers: TravelerCount;
  contact_info: {
    email: string;
    phone?: string;
    name: string;
  };
  idempotency_key: string;
}

export interface BookingResponse {
  booking_id: string; // Provider's booking ID
  status: 'confirmed' | 'pending';
  price: {
    amount: number;
    currency: string;
  };
  policies: {
    cancellation: string;
    refund: string;
    cancellation_deadline?: string;
  };
  voucher_url?: string;
  voucher_data?: string; // Base64 encoded voucher
  confirmation_number: string;
  expires_at?: string; // For pending bookings
}

export interface BookingStatus {
  booking_id: string;
  status: 'confirmed' | 'pending' | 'canceled';
  price: {
    amount: number;
    currency: string;
  };
  voucher_url?: string;
}

export interface CancelResponse {
  booking_id: string;
  refund_amount?: {
    amount: number;
    currency: string;
  };
  refund_status: 'full' | 'partial' | 'none';
}

export interface WebhookEvent {
  event_type: 'booking_confirmed' | 'booking_canceled' | 'price_changed' | 'availability_changed';
  provider_booking_id: string;
  gobuddy_booking_id?: string;
  timestamp: string;
  payload: unknown;
}

export interface ProviderAdapter {
  // Search/Query
  search(options: SearchOptions): Promise<SearchResult[]>;
  getDetails(id: string): Promise<ItemDetails>;

  // Availability
  checkAvailability(id: string, date: string, travelers: TravelerCount): Promise<Availability>;

  // Booking
  createBooking(request: BookingRequest): Promise<BookingResponse>;
  getBookingStatus(bookingId: string): Promise<BookingStatus>;
  cancelBooking(bookingId: string): Promise<CancelResponse>;

  // Webhooks
  handleWebhook(payload: unknown): Promise<WebhookEvent>;

  // Health check
  healthCheck(): Promise<boolean>;
}

