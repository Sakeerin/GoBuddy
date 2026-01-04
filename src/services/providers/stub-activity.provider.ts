import { ProviderAdapter, SearchOptions, SearchResult, ItemDetails, Availability, TravelerCount, BookingRequest, BookingResponse, BookingStatus, CancelResponse, WebhookEvent } from './provider-adapter.interface';
import { logger } from '@/utils/logger';
import { ExternalServiceError } from '@/utils/errors';

/**
 * Stub Activity Provider for MVP
 * Simulates activity booking without real API calls
 */
export class StubActivityProvider implements ProviderAdapter {
  name = 'stub-activity';

  async search(options: SearchOptions): Promise<SearchResult[]> {
    // Return mock search results
    return [
      {
        id: 'stub-activity-1',
        name: 'City Tour',
        description: 'Guided city tour',
        location: options.location,
        price: {
          amount: 500,
          currency: 'THB',
        },
        rating: 4.5,
        images: [],
      },
      {
        id: 'stub-activity-2',
        name: 'Cooking Class',
        description: 'Thai cooking class',
        location: options.location,
        price: {
          amount: 1200,
          currency: 'THB',
        },
        rating: 4.8,
        images: [],
      },
    ];
  }

  async getDetails(id: string): Promise<ItemDetails> {
    // Return mock details
    return {
      id,
      name: 'Activity Details',
      description: 'Activity description',
      price: {
        amount: 500,
        currency: 'THB',
      },
      availability: {
        available: true,
        slots: [
          { time: '09:00', available: true },
          { time: '14:00', available: true },
          { time: '18:00', available: false },
        ],
      },
      policies: {
        cancellation: 'Free cancellation up to 24 hours before',
        refund: 'Full refund',
      },
      images: [],
      rating: 4.5,
    };
  }

  async checkAvailability(id: string, date: string, travelers: TravelerCount): Promise<Availability> {
    // Mock availability check
    return {
      available: true,
      slots: [
        {
          time: '09:00',
          available: true,
          price: {
            amount: 500 * travelers.adults,
            currency: 'THB',
          },
        },
        {
          time: '14:00',
          available: true,
          price: {
            amount: 500 * travelers.adults,
            currency: 'THB',
          },
        },
      ],
    };
  }

  async createBooking(request: BookingRequest): Promise<BookingResponse> {
    // Simulate API delay
    await this.delay(500);

    // Simulate occasional failures (10% failure rate)
    if (Math.random() < 0.1) {
      throw new ExternalServiceError(
        'Stub Provider',
        'Simulated booking failure'
      );
    }

    // Generate mock booking
    const bookingId = `stub-booking-${Date.now()}`;
    const confirmationNumber = `STUB${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    return {
      booking_id: bookingId,
      status: 'confirmed',
      price: {
        amount: 500 * request.travelers.adults,
        currency: 'THB',
      },
      policies: {
        cancellation: 'Free cancellation up to 24 hours before',
        refund: 'Full refund',
        cancellation_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      voucher_url: `https://stub.voucher.url/${bookingId}`,
      voucher_data: Buffer.from(`Voucher for ${request.provider_item_id}`).toString('base64'),
      confirmation_number: confirmationNumber,
    };
  }

  async getBookingStatus(bookingId: string): Promise<BookingStatus> {
    return {
      booking_id: bookingId,
      status: 'confirmed',
      price: {
        amount: 500,
        currency: 'THB',
      },
      voucher_url: `https://stub.voucher.url/${bookingId}`,
    };
  }

  async cancelBooking(bookingId: string): Promise<CancelResponse> {
    await this.delay(300);

    return {
      booking_id: bookingId,
      refund_amount: {
        amount: 500,
        currency: 'THB',
      },
      refund_status: 'full',
    };
  }

  async handleWebhook(payload: unknown): Promise<WebhookEvent> {
    // Stub webhook handler
    logger.info('Stub webhook received', { payload });
    return {
      event_type: 'booking_confirmed',
      provider_booking_id: 'stub-booking-id',
      timestamp: new Date().toISOString(),
      payload,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true; // Stub is always available
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

