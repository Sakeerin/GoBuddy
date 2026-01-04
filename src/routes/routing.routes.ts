import { Router } from 'express';
import { z } from 'zod';
import { routingService } from '@/services/routing/routing.service';
import { itineraryRoutingService } from '@/services/itinerary/itinerary-routing.service';
import { authenticateUserOrGuest } from '@/middleware/auth.middleware';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';

const router = Router();

// Validation schemas
const routeRequestSchema = z.object({
  from: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }),
  to: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }),
  mode: z.enum(['walking', 'transit', 'taxi', 'drive']),
  departure_time: z.string().datetime().optional(),
});

/**
 * POST /routing/compute
 * Compute route between two points
 */
router.post('/compute', async (req, res, next) => {
  try {
    const request = routeRequestSchema.parse(req.body);
    const route = await routingService.computeRoute({
      ...request,
      departure_time: request.departure_time ? new Date(request.departure_time) : undefined,
    });
    return successResponse(res, route);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * PATCH /trips/:tripId/items/:itemId/route
 * Update route mode for an itinerary item
 */
router.patch('/:tripId/items/:itemId/route', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, itemId } = req.params;
    const { mode } = z.object({
      mode: z.enum(['walking', 'transit', 'taxi', 'drive']),
    }).parse(req.body);

    const item = await itineraryRoutingService.updateItemRoute(tripId, itemId, mode);
    return successResponse(res, item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * POST /trips/:tripId/routes/update-all
 * Update all routes in itinerary
 */
router.post('/:tripId/routes/update-all', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const itinerary = await itineraryRoutingService.updateAllRoutes(tripId);
    return successResponse(res, itinerary);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /routing/providers
 * Get list of available routing providers
 */
router.get('/providers', async (req, res, next) => {
  try {
    const providers = await routingService.getAvailableProviders();
    return successResponse(res, { providers });
  } catch (error) {
    return next(error);
  }
});

export default router;

