import { itineraryGeneratorService } from '@/services/itinerary/itinerary-generator.service';
import { bookingService } from '@/services/booking/booking.service';
import { weatherService } from '@/services/events/weather.service';
import { tripService } from '@/services/trip/trip.service';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import { Itinerary, ItineraryItem, ItineraryDay } from '@/types/itinerary';
import { Booking } from '@/types/booking';

export interface TodayViewItem {
  item_id: string;
  name: string;
  start_time: string;
  end_time: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  navigation_url?: string;
  booking_status?: 'pending' | 'confirmed' | 'failed';
  check_in_required: boolean;
  notes?: string;
}

export interface TodayView {
  date: string;
  items: TodayViewItem[];
  weather?: {
    condition: string;
    temperature?: number;
    severity?: 'low' | 'medium' | 'high';
  };
  summary: {
    total_items: number;
    confirmed_bookings: number;
    pending_bookings: number;
  };
}

export interface OfflineCache {
  trip_id: string;
  itinerary: Itinerary;
  bookings: Booking[];
  cached_at: Date;
  expires_at: Date;
}

export class ExecutionModeService {
  /**
   * Get today's view for a trip
   */
  async getTodayView(tripId: string): Promise<TodayView> {
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    // Find today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find today's day in itinerary
    const { preferences } = await tripService.getTripWithPreferences(tripId);
    const startDate = new Date(preferences.dates.start);
    const daysDiff = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const todayDay = itinerary.days.find((d) => d.day === daysDiff);
    if (!todayDay) {
      return {
        date: todayStr,
        items: [],
        summary: {
          total_items: 0,
          confirmed_bookings: 0,
          pending_bookings: 0,
        },
      };
    }

    // Get bookings for trip
    const bookings = await bookingService.getBookingsByTripId(tripId);
    const bookingsByItemId = new Map<string, Booking>();
    bookings.forEach((b) => {
      if (b.itinerary_item_id) {
        bookingsByItemId.set(b.itinerary_item_id, b);
      }
    });

    // Build today view items
    const items: TodayViewItem[] = todayDay.items.map((item) => {
      const booking = bookingsByItemId.get(item.id);
      const navigationUrl = item.location
        ? this.generateNavigationUrl(item.location)
        : undefined;

      return {
        item_id: item.id,
        name: item.name,
        start_time: item.start_time,
        end_time: item.end_time,
        location: item.location,
        navigation_url: navigationUrl,
        booking_status: booking?.status === 'confirmed' ? 'confirmed' : booking?.status === 'pending' ? 'pending' : booking?.status === 'failed' ? 'failed' : undefined,
        check_in_required: booking?.status === 'confirmed' && this.requiresCheckIn(item),
        notes: item.notes,
      };
    });

    // Get weather for today
    const weather = await this.getWeatherForLocation(
      todayDay.items[0]?.location || preferences.destination.coordinates,
      today
    );

    // Calculate summary
    const confirmedBookings = items.filter((i) => i.booking_status === 'confirmed').length;
    const pendingBookings = items.filter((i) => i.booking_status === 'pending').length;

    return {
      date: todayStr,
      items,
      weather,
      summary: {
        total_items: items.length,
        confirmed_bookings: confirmedBookings,
        pending_bookings: pendingBookings,
      },
    };
  }

  /**
   * Generate navigation URL (Google Maps)
   */
  private generateNavigationUrl(location: { lat: number; lng: number; address?: string }): string {
    const { lat, lng, address } = location;
    if (address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  /**
   * Check if item requires check-in
   */
  private requiresCheckIn(item: ItineraryItem): boolean {
    // Simple heuristic: hotels and some activities require check-in
    return item.item_type === 'hotel' || item.name.toLowerCase().includes('hotel');
  }

  /**
   * Get weather for location
   */
  private async getWeatherForLocation(
    location: { lat: number; lng: number } | undefined,
    date: Date
  ): Promise<TodayView['weather'] | undefined> {
    if (!location) return undefined;

    try {
      const weather = await weatherService.getWeatherForecast(location.lat, location.lng, date);
      return {
        condition: weather.details.condition,
        temperature: weather.details.temperature,
        severity: weather.severity,
      };
    } catch (error) {
      logger.warn('Failed to get weather', { error });
      return undefined;
    }
  }

  /**
   * Create offline cache for trip
   */
  async createOfflineCache(tripId: string): Promise<OfflineCache> {
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    const bookings = await bookingService.getBookingsByTripId(tripId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Cache for 7 days

    return {
      trip_id: tripId,
      itinerary,
      bookings,
      cached_at: new Date(),
      expires_at: expiresAt,
    };
  }

  /**
   * Get offline cache (if exists and not expired)
   */
  async getOfflineCache(tripId: string): Promise<OfflineCache | null> {
    // For MVP, we'll use a simple in-memory cache
    // In production, use Redis or local storage
    try {
      const cache = await this.createOfflineCache(tripId);
      if (cache.expires_at > new Date()) {
        return cache;
      }
    } catch (error) {
      logger.warn('Failed to get offline cache', { tripId, error });
    }

    return null;
  }
}

export const executionModeService = new ExecutionModeService();

