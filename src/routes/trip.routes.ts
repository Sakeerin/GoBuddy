import { Router } from 'express';
import { z } from 'zod';
import { tripService } from '@/services/trip/trip.service';
import { authenticateUserOrGuest, requireUser } from '@/middleware/auth.middleware';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';
import { TripStyle } from '@/types/trip';

const router = Router();

// Validation schemas
const createTripSchema = z.object({
  destination: z.object({
    city: z.string().min(1),
    country: z.string().min(1),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
  }),
  dates: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  travelers: z.object({
    adults: z.number().int().min(1),
    children: z.number().int().min(0),
    seniors: z.number().int().min(0),
  }),
  budget: z.object({
    total: z.number().positive().optional(),
    per_day: z.number().positive().optional(),
    currency: z.string().length(3),
  }),
  style: z.enum(['city_break', 'nature', 'theme', 'workation', 'family']),
  daily_time_window: z.object({
    start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  }),
  constraints: z.object({
    max_walking_km_per_day: z.number().positive().optional(),
    has_children: z.boolean(),
    has_seniors: z.boolean(),
    needs_rest_time: z.boolean(),
    avoid_crowds: z.boolean(),
    risk_areas_to_avoid: z.array(z.string()).optional(),
  }),
});

const updateTripSchema = createTripSchema.partial();

/**
 * POST /trips
 * Create a new trip
 */
router.post('/', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const tripData = createTripSchema.parse(req.body);
    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;

    const trip = await tripService.createTrip(userId, guestSessionId, tripData);
    return successResponse(res, trip, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /trips
 * List trips for current user/guest
 */
router.get('/', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;
    const status = req.query.status as string | undefined;

    const trips = await tripService.listTrips(userId, guestSessionId, status);
    return successResponse(res, trips);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:id
 * Get trip by ID
 */
router.get('/:id', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;

    const { trip, preferences } = await tripService.getTripWithPreferences(
      id,
      userId,
      guestSessionId
    );

    return successResponse(res, { trip, preferences });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /trips/:id
 * Update trip
 */
router.patch('/:id', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = updateTripSchema.parse(req.body);
    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;

    const trip = await tripService.updateTrip(id, userId, guestSessionId, updates);
    return successResponse(res, trip);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * DELETE /trips/:id
 * Delete trip
 */
router.delete('/:id', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;

    await tripService.deleteTrip(id, userId, guestSessionId);
    return successResponse(res, { message: 'Trip deleted successfully' });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /trips/:id/status
 * Update trip status
 */
router.patch('/:id/status', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = z.object({
      status: z.enum(['draft', 'planning', 'booked', 'active', 'completed', 'cancelled']),
    }).parse(req.body);

    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;

    const trip = await tripService.updateTripStatus(id, status, userId, guestSessionId);
    return successResponse(res, trip);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

export default router;

