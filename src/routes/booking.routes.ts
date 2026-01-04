import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { bookingService } from '@/services/booking/booking.service';
import { bookingOrchestratorService } from '@/services/booking/booking-orchestrator.service';
import { bookingAlternativesService } from '@/services/booking/booking-alternatives.service';
import { providerRegistry } from '@/services/providers/provider-registry';
import { authenticateUserOrGuest, requireUser } from '@/middleware/auth.middleware';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';

const router = Router();

// Validation schemas
const createBookingSchema = z.object({
  itinerary_item_id: z.string().uuid().optional(),
  provider_id: z.string(),
  provider_option_id: z.string(),
  traveler_details: z.object({
    adults: z.number().int().min(1),
    children: z.number().int().min(0).optional(),
    seniors: z.number().int().min(0).optional(),
  }),
  contact_info: z.object({
    email: z.string().email(),
    phone: z.string().optional(),
    name: z.string().min(1),
  }),
  booking_date: z.string().date(),
  booking_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /trips/:tripId/bookings
 * Create a new booking
 */
router.post('/:tripId/bookings', authenticateUserOrGuest, requireUser, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const request = createBookingSchema.parse(req.body);
    const userId = req.user?.id;

    // Generate idempotency key if not provided
    const idempotencyKey = req.headers['x-idempotency-key'] as string || uuidv4();

    const booking = await bookingOrchestratorService.createBooking(
      tripId,
      { ...request, idempotency_key: idempotencyKey },
      userId
    );

    return successResponse(res, booking, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /trips/:tripId/bookings
 * Get all bookings for a trip
 */
router.get('/:tripId/bookings', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const bookings = await bookingService.getBookingsByTripId(tripId);
    return successResponse(res, bookings);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/bookings/:bookingId
 * Get booking details
 */
router.get('/:tripId/bookings/:bookingId', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const booking = await bookingService.getBookingById(bookingId);
    return successResponse(res, booking);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/bookings/:bookingId/history
 * Get booking state history
 */
router.get('/:tripId/bookings/:bookingId/history', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const history = await bookingService.getBookingStateHistory(bookingId);
    return successResponse(res, history);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /trips/:tripId/bookings/:bookingId/retry
 * Retry a failed booking
 */
router.post('/:tripId/bookings/:bookingId/retry', authenticateUserOrGuest, requireUser, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    const booking = await bookingOrchestratorService.retryBooking(bookingId, userId);
    return successResponse(res, booking);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /trips/:tripId/bookings/:bookingId/cancel
 * Cancel a booking
 */
router.post('/:tripId/bookings/:bookingId/cancel', authenticateUserOrGuest, requireUser, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason } = z.object({
      reason: z.string().optional(),
    }).parse(req.body);
    const userId = req.user?.id;

    const booking = await bookingOrchestratorService.cancelBooking(bookingId, reason, userId);
    return successResponse(res, booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /trips/:tripId/bookings/:bookingId/alternatives
 * Get alternative booking options for a failed booking
 */
router.get('/:tripId/bookings/:bookingId/alternatives', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const alternatives = await bookingAlternativesService.findAlternatives(bookingId);
    return successResponse(res, { alternatives });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /providers/:providerId/search
 * Search items from a provider
 */
router.get('/providers/:providerId/search', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const provider = providerRegistry.getProvider(providerId);

    if (!provider) {
      return next(new ValidationError(`Provider ${providerId} not found`));
    }

    const { location, category, date, travelers, price_range } = z.object({
      location: z.object({
        lat: z.number(),
        lng: z.number(),
        radius_km: z.number().optional(),
      }).optional(),
      category: z.string().optional(),
      date: z.string().optional(),
      travelers: z.object({
        adults: z.number().int().min(1),
        children: z.number().int().min(0).optional(),
      }).optional(),
      price_range: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        currency: z.string().optional(),
      }).optional(),
    }).parse(req.query);

    const results = await provider.search({
      location,
      category,
      date,
      travelers,
      price_range,
    });

    return successResponse(res, results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /providers/:providerId/items/:itemId
 * Get item details from provider
 */
router.get('/providers/:providerId/items/:itemId', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { providerId, itemId } = req.params;
    const provider = providerRegistry.getProvider(providerId);

    if (!provider) {
      return next(new ValidationError(`Provider ${providerId} not found`));
    }

    const details = await provider.getDetails(itemId);
    return successResponse(res, details);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /providers/:providerId/items/:itemId/availability
 * Check availability for an item
 */
router.get('/providers/:providerId/items/:itemId/availability', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { providerId, itemId } = req.params;
    const { date, travelers } = z.object({
      date: z.string().date(),
      travelers: z.object({
        adults: z.number().int().min(1),
        children: z.number().int().min(0).optional(),
        seniors: z.number().int().min(0).optional(),
      }),
    }).parse(req.query);

    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      return next(new ValidationError(`Provider ${providerId} not found`));
    }

    const availability = await provider.checkAvailability(itemId, date, travelers);
    return successResponse(res, availability);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * POST /webhooks/providers/:providerId
 * Handle webhook from provider
 */
router.post('/webhooks/providers/:providerId', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    await bookingOrchestratorService.processWebhook(providerId, req.body);
    return successResponse(res, { message: 'Webhook processed' });
  } catch (error) {
    return next(error);
  }
});

export default router;

