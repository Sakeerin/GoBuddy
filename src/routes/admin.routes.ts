import { Router } from 'express';
import { z } from 'zod';
import { adminService } from '@/services/admin/admin.service';
import { providerManagementService } from '@/services/admin/provider-management.service';
import { webhookLogService } from '@/services/admin/webhook-log.service';
import { bookingTroubleshootingService } from '@/services/admin/booking-troubleshooting.service';
import { metricsService } from '@/services/observability/metrics.service';
import { authenticateUser, requireUser } from '@/middleware/auth.middleware';
import { requireAdmin, requireAdminPermission } from '@/middleware/admin-auth.middleware';
import { successResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';

const router = Router();

// All admin routes require authentication and admin access
router.use(authenticateUser);
router.use(requireUser);
router.use(requireAdmin);

// Validation schemas
const createProviderSchema = z.object({
  provider_id: z.string(),
  provider_name: z.string(),
  provider_type: z.enum(['activity', 'hotel', 'transport']),
  api_credentials: z.object({
    api_key: z.string(),
    api_secret: z.string().optional(),
    base_url: z.string().url(),
  }),
  webhook_config: z.object({
    endpoint_url: z.string().url(),
    secret: z.string(),
  }),
  commission_rules: z.object({
    rate: z.number(),
    calculation: z.enum(['percentage', 'fixed']),
  }),
  retry_config: z.object({
    max_retries: z.number().int().min(0),
    backoff_strategy: z.enum(['exponential', 'linear']),
  }),
  rate_limits: z.object({
    requests_per_minute: z.number().int().positive(),
    requests_per_day: z.number().int().positive(),
  }),
  enabled: z.boolean().optional(),
});

/**
 * POST /admin/users/:userId/make-admin
 * Create admin user
 */
router.post('/users/:userId/make-admin', requireAdminPermission('*'), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = z.object({
      role: z.enum(['super_admin', 'admin', 'support']),
    }).parse(req.body);

    const adminId = req.user?.id;
    if (!adminId) {
      return next(new ValidationError('User authentication required'));
    }

    const admin = await adminService.createAdminUser(userId, role, adminId);
    return successResponse(res, admin, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /admin/providers
 * List all providers
 */
router.get('/providers', requireAdminPermission('providers:read'), async (req, res, next) => {
  try {
    const providers = await providerManagementService.listProviders();
    return successResponse(res, providers);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /admin/providers
 * Create provider
 */
router.post('/providers', requireAdminPermission('providers:write'), async (req, res, next) => {
  try {
    const config = createProviderSchema.parse(req.body);
    const adminId = req.user?.id;

    if (!adminId) {
      return next(new ValidationError('User authentication required'));
    }

    const provider = await providerManagementService.createProvider(config, adminId);
    return successResponse(res, provider, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /admin/providers/:providerId
 * Get provider details
 */
router.get('/providers/:providerId', requireAdminPermission('providers:read'), async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const withCredentials = req.query.credentials === 'true';

    const provider = withCredentials
      ? await providerManagementService.getProviderWithCredentials(providerId)
      : await providerManagementService.getProvider(providerId);

    return successResponse(res, provider);
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /admin/providers/:providerId
 * Update provider
 */
router.patch('/providers/:providerId', requireAdminPermission('providers:write'), async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const updates = createProviderSchema.partial().parse(req.body);
    const adminId = req.user?.id;

    if (!adminId) {
      return next(new ValidationError('User authentication required'));
    }

    const provider = await providerManagementService.updateProvider(providerId, updates, adminId);
    return successResponse(res, provider);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * DELETE /admin/providers/:providerId
 * Delete provider
 */
router.delete('/providers/:providerId', requireAdminPermission('providers:write'), async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      return next(new ValidationError('User authentication required'));
    }

    await providerManagementService.deleteProvider(providerId, adminId);
    return successResponse(res, { message: 'Provider deleted successfully' });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /admin/providers/:providerId/health
 * Check provider health
 */
router.get('/providers/:providerId/health', requireAdminPermission('providers:read'), async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const health = await providerManagementService.checkProviderHealth(providerId);
    return successResponse(res, health);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /admin/webhooks
 * List webhook logs
 */
router.get('/webhooks', requireAdminPermission('webhooks:read'), async (req, res, next) => {
  try {
    const { provider_id, status, limit } = z.object({
      provider_id: z.string().optional(),
      status: z.enum(['success', 'failed', 'pending']).optional(),
      limit: z.number().int().positive().optional(),
    }).parse(req.query);

    const logs = await webhookLogService.listWebhookLogs(
      provider_id,
      status,
      limit || 100
    );

    return successResponse(res, logs);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * POST /admin/webhooks/:logId/retry
 * Retry failed webhook
 */
router.post('/webhooks/:logId/retry', requireAdminPermission('webhooks:retry'), async (req, res, next) => {
  try {
    const { logId } = req.params;
    const log = await webhookLogService.retryWebhook(logId);
    return successResponse(res, log);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /admin/bookings/:bookingId/troubleshoot
 * Get booking troubleshooting info
 */
router.get('/bookings/:bookingId/troubleshoot', requireAdminPermission('bookings:read'), async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const details = await bookingTroubleshootingService.getBookingDetails(bookingId);
    return successResponse(res, details);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /admin/bookings/:bookingId/resend-voucher
 * Resend voucher
 */
router.post('/bookings/:bookingId/resend-voucher', requireAdminPermission('bookings:resend_voucher'), async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      return next(new ValidationError('User authentication required'));
    }

    await bookingTroubleshootingService.resendVoucher(bookingId, adminId);
    return successResponse(res, { message: 'Voucher resend requested' });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /admin/bookings/:bookingId/override-status
 * Override booking status
 */
router.post('/bookings/:bookingId/override-status', requireAdminPermission('bookings:override'), async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { status, reason } = z.object({
      status: z.enum(['pending', 'confirmed', 'failed', 'canceled', 'refunded']),
      reason: z.string().min(1),
    }).parse(req.body);

    const adminId = req.user?.id;
    if (!adminId) {
      return next(new ValidationError('User authentication required'));
    }

    const booking = await bookingTroubleshootingService.overrideBookingStatus(
      bookingId,
      status,
      reason,
      adminId
    );

    return successResponse(res, booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /admin/bookings/statistics
 * Get booking statistics
 */
router.get('/bookings/statistics', requireAdminPermission('bookings:read'), async (req, res, next) => {
  try {
    const { start_date, end_date } = z.object({
      start_date: z.string().datetime().optional(),
      end_date: z.string().datetime().optional(),
    }).parse(req.query);

    const stats = await bookingTroubleshootingService.getBookingStatistics(
      start_date ? new Date(start_date) : undefined,
      end_date ? new Date(end_date) : undefined
    );

    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /admin/audit-log
 * Get admin audit log
 */
router.get('/audit-log', requireAdminPermission('*'), async (req, res, next) => {
  try {
    const { admin_id, limit } = z.object({
      admin_id: z.string().uuid().optional(),
      limit: z.number().int().positive().optional(),
    }).parse(req.query);

    const auditLog = await adminService.getAuditLog(admin_id, limit || 100);
    return successResponse(res, auditLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /admin/metrics
 * Get system metrics
 */
router.get('/metrics', requireAdminPermission('system:metrics'), async (req, res, next) => {
  try {
    const metrics = await metricsService.getSystemMetrics();
    return successResponse(res, metrics);
  } catch (error) {
    return next(error);
  }
});

export default router;
