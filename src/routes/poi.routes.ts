import { Router } from 'express';
import { z } from 'zod';
import { poiService } from '@/services/poi/poi.service';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';
import { POISearchFilters } from '@/types/poi';

const router = Router();

// Validation schemas
const searchFiltersSchema = z.object({
  q: z.string().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    radius_km: z.number().positive().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  budget_range: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
  open_now: z.boolean().optional(),
  kid_friendly: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  per_page: z.number().int().positive().max(100).optional(),
});

/**
 * GET /pois/search
 * Search POIs with filters
 */
router.get('/search', async (req, res, next) => {
  try {
    const filters = searchFiltersSchema.parse({
      ...req.query,
      location: req.query.location
        ? (typeof req.query.location === 'string'
            ? JSON.parse(req.query.location)
            : req.query.location)
        : undefined,
      tags: req.query.tags
        ? (typeof req.query.tags === 'string'
            ? req.query.tags.split(',')
            : req.query.tags)
        : undefined,
      budget_range: req.query.budget_range
        ? (typeof req.query.budget_range === 'string'
            ? JSON.parse(req.query.budget_range)
            : req.query.budget_range)
        : undefined,
      open_now: req.query.open_now === 'true',
      kid_friendly: req.query.kid_friendly === 'true',
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      per_page: req.query.per_page ? parseInt(req.query.per_page as string, 10) : undefined,
    });

    const result = await poiService.search(filters as POISearchFilters);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /pois/:id
 * Get POI by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const poi = await poiService.getPOIById(id);
    return successResponse(res, poi);
  } catch (error) {
    return next(error);
  }
});

export default router;

