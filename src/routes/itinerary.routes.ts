import { Router } from 'express';
import { z } from 'zod';
import { itineraryGeneratorService } from '@/services/itinerary/itinerary-generator.service';
import { itineraryEditorService } from '@/services/itinerary/itinerary-editor.service';
import { itineraryVersionService } from '@/services/itinerary/itinerary-version.service';
import { authenticateUserOrGuest } from '@/middleware/auth.middleware';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';

const router = Router();

// Validation schemas
const generateItinerarySchema = z.object({
  selected_poi_ids: z.array(z.string().uuid()).min(1),
  optimize_budget: z.boolean().optional(),
  regenerate_mode: z.enum(['full', 'incremental']).optional(),
  preserve_pinned: z.boolean().optional(),
});

/**
 * POST /trips/:tripId/generate
 * Generate itinerary for a trip
 */
router.post('/:tripId/generate', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const request = generateItinerarySchema.parse(req.body);
    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;

    const result = await itineraryGeneratorService.generateItinerary(
      tripId,
      request,
      userId,
      guestSessionId
    );

    return successResponse(res, result, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /trips/:tripId/itinerary
 * Get itinerary for a trip
 */
router.get('/:tripId/itinerary', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);

    if (!itinerary) {
      return successResponse(res, null, 404);
    }

    return successResponse(res, itinerary);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /trips/:tripId/days/:day/items/reorder
 * Reorder items within a day
 */
router.post('/:tripId/days/:day/items/reorder', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, day } = req.params;
    const { item_ids } = z.object({
      item_ids: z.array(z.string().uuid()),
    }).parse(req.body);

    const items = await itineraryEditorService.reorderItems(
      tripId,
      parseInt(day, 10),
      item_ids
    );

    return successResponse(res, items);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * PATCH /trips/:tripId/items/:itemId/pin
 * Pin/unpin an item
 */
router.patch('/:tripId/items/:itemId/pin', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, itemId } = req.params;
    const { pinned } = z.object({
      pinned: z.boolean(),
    }).parse(req.body);

    const item = await itineraryEditorService.togglePin(tripId, itemId, pinned);
    return successResponse(res, item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * PATCH /trips/:tripId/items/:itemId/start-time
 * Set custom start time for an item
 */
router.patch('/:tripId/items/:itemId/start-time', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, itemId } = req.params;
    const { start_time } = z.object({
      start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    }).parse(req.body);

    const item = await itineraryEditorService.setStartTime(tripId, itemId, start_time);
    return successResponse(res, item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * DELETE /trips/:tripId/items/:itemId
 * Remove an item
 */
router.delete('/:tripId/items/:itemId', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, itemId } = req.params;
    await itineraryEditorService.removeItem(tripId, itemId);
    return successResponse(res, { message: 'Item removed successfully' });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /trips/:tripId/days/:day/items
 * Add a new item to a day
 */
router.post('/:tripId/days/:day/items', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, day } = req.params;
    const { poi_id, start_time } = z.object({
      poi_id: z.string().uuid(),
      start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    }).parse(req.body);

    const item = await itineraryEditorService.addItem(
      tripId,
      parseInt(day, 10),
      poi_id,
      start_time
    );

    return successResponse(res, item, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /trips/:tripId/itinerary/validate
 * Validate itinerary
 */
router.get('/:tripId/itinerary/validate', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const validation = await itineraryEditorService.validateItinerary(tripId);
    return successResponse(res, validation);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/versions
 * Get version history
 */
router.get('/:tripId/versions', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const history = await itineraryVersionService.getVersionHistory(tripId);
    return successResponse(res, history);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/versions/:version
 * Get specific version
 */
router.get('/:tripId/versions/:version', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, version } = req.params;
    const versionData = await itineraryVersionService.getVersion(
      tripId,
      parseInt(version, 10)
    );
    return successResponse(res, versionData);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/versions/:version1/compare/:version2
 * Compare two versions
 */
router.get('/:tripId/versions/:version1/compare/:version2', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, version1, version2 } = req.params;
    const diff = await itineraryVersionService.compareVersions(
      tripId,
      parseInt(version1, 10),
      parseInt(version2, 10)
    );
    return successResponse(res, diff);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /trips/:tripId/versions/:version/rollback
 * Rollback to a previous version
 */
router.post('/:tripId/versions/:version/rollback', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, version } = req.params;
    const userId = req.user?.id;
    const guestSessionId = req.guestSessionId;

    const itinerary = await itineraryVersionService.rollbackToVersion(
      tripId,
      parseInt(version, 10),
      userId,
      guestSessionId
    );

    return successResponse(res, itinerary);
  } catch (error) {
    return next(error);
  }
});

export default router;

