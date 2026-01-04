import { Router } from 'express';
import { z } from 'zod';
import { sharingService } from '@/services/sharing/sharing.service';
import { executionModeService } from '@/services/execution/execution-mode.service';
import { authenticateUserOrGuest, requireUser } from '@/middleware/auth.middleware';
import { authenticateShare, requirePermission } from '@/middleware/share-auth.middleware';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';

const router = Router();

// Validation schemas
const createShareSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']),
  expires_at: z.string().datetime().optional(),
});

/**
 * POST /trips/:tripId/shares
 * Create a share link
 */
router.post('/:tripId/shares', authenticateUserOrGuest, requireUser, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const request = createShareSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return next(new ValidationError('User authentication required'));
    }

    const share = await sharingService.createShare(tripId, request, userId);
    return successResponse(res, share, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /trips/:tripId/shares
 * Get all shares for a trip
 */
router.get('/:tripId/shares', authenticateUserOrGuest, requireUser, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const shares = await sharingService.getSharesByTripId(tripId);
    return successResponse(res, shares);
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /trips/:tripId/shares/:shareToken
 * Revoke a share
 */
router.delete('/:tripId/shares/:shareToken', authenticateUserOrGuest, requireUser, async (req, res, next) => {
  try {
    const { shareToken } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return next(new ValidationError('User authentication required'));
    }

    await sharingService.revokeShare(shareToken, userId);
    return successResponse(res, { message: 'Share revoked successfully' });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/shared/:shareToken
 * Access shared trip via token
 */
router.get('/shared/:shareToken', authenticateShare, requirePermission('view'), async (req, res, next) => {
  try {
    const { shareToken } = req.params;
    const share = await sharingService.getShareByToken(shareToken);
    return successResponse(res, {
      share,
      access: req.shareAccess,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/shares/audit
 * Get audit log for shares
 */
router.get('/:tripId/shares/audit', authenticateUserOrGuest, requireUser, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const auditLog = await sharingService.getAuditLog(tripId);
    return successResponse(res, auditLog);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/today
 * Get today's view for execution mode
 */
router.get('/:tripId/today', authenticateUserOrGuest, authenticateShare, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const todayView = await executionModeService.getTodayView(tripId);
    return successResponse(res, todayView);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /trips/:tripId/offline-cache
 * Get offline cache for trip
 */
router.get('/:tripId/offline-cache', authenticateUserOrGuest, authenticateShare, async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const cache = await executionModeService.createOfflineCache(tripId);
    return successResponse(res, cache);
  } catch (error) {
    return next(error);
  }
});

export default router;

