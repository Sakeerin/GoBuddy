import { Router } from 'express';
import { z } from 'zod';
import { costingService } from '@/services/costing/costing.service';
import { authenticateUserOrGuest } from '@/middleware/auth.middleware';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';

const router = Router();

/**
 * GET /trips/:tripId/cost-breakdown
 * Get cost breakdown for itinerary
 */
router.get('/:tripId/cost-breakdown', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const breakdown = await costingService.calculateCostBreakdown(tripId);
    return successResponse(res, breakdown);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /costing/convert-currency
 * Convert currency amount
 */
router.post('/convert-currency', async (req, res, next) => {
  try {
    const { amount, from_currency, to_currency } = z.object({
      amount: z.number().positive(),
      from_currency: z.string().length(3),
      to_currency: z.string().length(3),
    }).parse(req.body);

    const converted = await costingService.convertCurrency(amount, from_currency, to_currency);
    return successResponse(res, {
      original: { amount, currency: from_currency },
      converted: { amount: converted, currency: to_currency },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * PATCH /trips/:tripId/items/:itemId/cost
 * Update item cost
 */
router.patch('/:tripId/items/:itemId/cost', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId, itemId } = req.params;
    const { amount, currency, confidence } = z.object({
      amount: z.number().nonnegative(),
      currency: z.string().length(3),
      confidence: z.enum(['fixed', 'estimated']),
    }).parse(req.body);

    await costingService.updateItemCost(tripId, itemId, { amount, currency, confidence });
    return successResponse(res, { message: 'Cost updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

export default router;

