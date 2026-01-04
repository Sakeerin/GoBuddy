import { bookingService } from './booking.service';
import { providerRegistry } from '../providers/provider-registry';
import { logger } from '@/utils/logger';
import { NotFoundError, ExternalServiceError } from '@/utils/errors';
import { CreateBookingRequest, Booking } from '@/types/booking';

export class BookingOrchestratorService {
  /**
   * Create booking through provider
   */
  async createBooking(
    tripId: string,
    request: CreateBookingRequest,
    userId?: string
  ): Promise<Booking> {
    // Get provider adapter
    const provider = providerRegistry.getProvider(request.provider_id);
    if (!provider) {
      throw new NotFoundError('Provider', request.provider_id);
    }

    // Create booking record (pending status)
    const booking = await bookingService.createBooking(tripId, request, userId);

    try {
      // Call provider to create booking
      const providerResponse = await provider.createBooking({
        provider_item_id: request.provider_option_id,
        date: request.booking_date,
        time_slot: request.booking_time,
        travelers: request.traveler_details,
        contact_info: request.contact_info,
        idempotency_key: request.idempotency_key,
      });

      // Update booking with provider response
      await bookingService.updateBookingStatus(
        booking.id,
        providerResponse.status === 'confirmed' ? 'confirmed' : 'pending',
        'Provider booking created',
        'system',
        {
          external_booking_id: providerResponse.booking_id,
          price: providerResponse.price,
          policies: providerResponse.policies,
          voucher_url: providerResponse.voucher_url,
          voucher_data: providerResponse.voucher_data,
          confirmation_number: providerResponse.confirmation_number,
        }
      );

      logger.info('Booking created successfully', {
        bookingId: booking.id,
        providerId: request.provider_id,
        externalId: providerResponse.booking_id,
      });

      return await bookingService.getBookingById(booking.id);
    } catch (error) {
      // Mark booking as failed
      await bookingService.updateBookingStatus(
        booking.id,
        'failed',
        error instanceof Error ? error.message : 'Provider booking failed',
        'system'
      );

      logger.error('Booking creation failed', {
        bookingId: booking.id,
        providerId: request.provider_id,
        error,
      });

      throw error;
    }
  }

  /**
   * Retry failed booking
   */
  async retryBooking(bookingId: string, userId?: string): Promise<Booking> {
    const booking = await bookingService.getBookingById(bookingId);

    if (booking.status !== 'failed') {
      throw new Error('Can only retry failed bookings');
    }

    // Get original request details from booking
    const request: CreateBookingRequest = {
      itinerary_item_id: booking.itinerary_item_id || undefined,
      provider_id: booking.provider_id,
      provider_option_id: booking.external_booking_id, // Reuse external ID
      traveler_details: booking.traveler_details,
      contact_info: booking.contact_info,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time || undefined,
      idempotency_key: `${booking.id}-retry-${Date.now()}`, // New idempotency key for retry
    };

    // Update status to pending
    await bookingService.updateBookingStatus(
      bookingId,
      'pending',
      'Retrying booking',
      userId || 'system'
    );

    // Try to create booking again
    try {
      const provider = providerRegistry.getProvider(booking.provider_id);
      if (!provider) {
        throw new NotFoundError('Provider', booking.provider_id);
      }

      const providerResponse = await provider.createBooking({
        provider_item_id: booking.external_booking_id,
        date: booking.booking_date,
        time_slot: booking.booking_time || undefined,
        travelers: booking.traveler_details,
        contact_info: booking.contact_info,
        idempotency_key: request.idempotency_key,
      });

      // Update booking
      await bookingService.updateBookingStatus(
        bookingId,
        providerResponse.status === 'confirmed' ? 'confirmed' : 'pending',
        'Retry successful',
        userId || 'system',
        {
          external_booking_id: providerResponse.booking_id,
          price: providerResponse.price,
          policies: providerResponse.policies,
          voucher_url: providerResponse.voucher_url,
          voucher_data: providerResponse.voucher_data,
          confirmation_number: providerResponse.confirmation_number,
        }
      );

      return await bookingService.getBookingById(bookingId);
    } catch (error) {
      await bookingService.updateBookingStatus(
        bookingId,
        'failed',
        error instanceof Error ? error.message : 'Retry failed',
        userId || 'system'
      );
      throw error;
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(
    bookingId: string,
    reason?: string,
    userId?: string
  ): Promise<Booking> {
    const booking = await bookingService.getBookingById(bookingId);

    if (booking.status !== 'confirmed') {
      throw new Error('Can only cancel confirmed bookings');
    }

    try {
      // Call provider to cancel
      const provider = providerRegistry.getProvider(booking.provider_id);
      if (provider) {
        await provider.cancelBooking(booking.external_booking_id);
      }

      // Update status
      await bookingService.updateBookingStatus(
        bookingId,
        'canceled',
        reason || 'Booking canceled by user',
        userId || 'system'
      );

      return await bookingService.getBookingById(bookingId);
    } catch (error) {
      logger.error('Booking cancellation failed', { bookingId, error });
      throw new ExternalServiceError(
        'Provider',
        'Failed to cancel booking',
        error
      );
    }
  }

  /**
   * Process webhook from provider
   */
  async processWebhook(
    providerId: string,
    payload: unknown
  ): Promise<void> {
    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      throw new NotFoundError('Provider', providerId);
    }

    try {
      const webhookEvent = await provider.handleWebhook(payload);

      // Find booking by external ID
      const bookingResult = await bookingService.getBookingsByTripId(''); // We need to search differently
      // TODO: Add method to find booking by external ID

      logger.info('Webhook processed', {
        providerId,
        eventType: webhookEvent.event_type,
      });
    } catch (error) {
      logger.error('Webhook processing failed', { providerId, error });
      throw error;
    }
  }
}

export const bookingOrchestratorService = new BookingOrchestratorService();

