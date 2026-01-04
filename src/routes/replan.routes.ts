import { Router } from 'express';
import { z } from 'zod';
import { eventMonitorService } from '@/services/events/event-monitor.service';
import { weatherService } from '@/services/events/weather.service';
import { replanEngineService } from '@/services/replan/replan-engine.service';
import { replanApplyService } from '@/services/replan/replan-apply.service';
import { authenticateUserOrGuest } from '@/middleware/auth.middleware';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';

const router = Router();

/**
 * POST /trips/:tripId/events/weather
 * Ingest weather event (for testing/monitoring)
 */
router.post('/:tripId/events/weather', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const { location, time_slot, severity } = z.object({
      location: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      time_slot: z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      }),
      severity: z.enum(['low', 'medium', 'high']),
      condition: z.string().optional(),
    }).parse(req.body);

    const details = {
      condition: req.body.condition || 'heavy_rain',
      impact: 'outdoor_activities_affected',
    };

    const event = await eventMonitorService.ingestWeatherEvent(
      tripId,
      location,
      time_slot,
      details,
      severity
    );

    return successResponse(res, event, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /trips/:tripId/events
 * Get event signals for trip
 */
router.get('/:tripId/events', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const processed = req.query.processed === 'true' ? true : req.query.processed === 'false' ? false : undefined;
    const events = await eventMonitorService.getEventSignals(tripId, processed);
    return successResponse(res, events);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/replan/triggers
 * Get pending replan triggers
 */
router.get('/:tripId/replan/triggers', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const triggers = await eventMonitorService.getPendingReplanTriggers(tripId);
    return successResponse(res, triggers);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /trips/:tripId/replan/propose
 * Generate replan proposals for a trigger
 */
router.post('/:tripId/replan/propose', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const { trigger_id, options_count } = z.object({
      trigger_id: z.string().uuid(),
      options_count: z.number().int().min(1).max(5).optional(),
    }).parse(req.body);

    const proposals = await replanEngineService.generateProposals(
      trigger_id,
      options_count || 3
    );

    return successResponse(res, { proposals });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /trips/:tripId/replan/proposals/:proposalId
 * Get specific proposal
 */
router.get('/:tripId/replan/proposals/:proposalId', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const proposal = await replanEngineService.getProposal(proposalId);
    return successResponse(res, proposal);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /trips/:tripId/replan/apply
 * Apply a replan proposal
 */
router.post('/:tripId/replan/apply', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const { proposal_id, idempotency_key } = z.object({
      proposal_id: z.string().uuid(),
      idempotency_key: z.string().uuid(),
    }).parse(req.body);

    const userId = req.user?.id;

    const result = await replanApplyService.applyProposal(
      { proposal_id, idempotency_key },
      userId
    );

    // Validate applied itinerary
    const validation = await replanApplyService.validateAppliedItinerary(tripId);
    if (!validation.valid) {
      logger.warn('Applied itinerary has issues', { tripId, issues: validation.issues });
    }

    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * POST /trips/:tripId/replan/rollback
 * Rollback a replan application
 */
router.post('/:tripId/replan/rollback', authenticateUserOrGuest, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const { application_id } = z.object({
      application_id: z.string().uuid(),
    }).parse(req.body);

    const userId = req.user?.id;

    await replanApplyService.rollbackReplan(tripId, application_id, userId);

    return successResponse(res, { message: 'Replan rolled back successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

export default router;

