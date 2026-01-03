import { Router } from 'express';
import { z } from 'zod';
import { userService } from '@/services/auth/user.service';
import { otpService } from '@/services/auth/otp.service';
import { googleOAuthService } from '@/services/auth/google-oauth.service';
import { guestService } from '@/services/auth/guest.service';
import { authenticateUser, requireUser } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';

const router = Router();

// Validation schemas
const emailSchema = z.object({
  email: z.string().email(),
});

const otpVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  language: z.string().optional(),
  currency: z.string().optional(),
  distance_unit: z.enum(['km', 'miles']).optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  mobility_constraints: z.array(z.string()).optional(),
  travel_preferences: z.object({
    budget: z.enum(['budget', 'mid', 'luxury']).optional(),
    comfort: z.enum(['basic', 'comfortable', 'premium']).optional(),
    adventure: z.enum(['low', 'medium', 'high']).optional(),
  }).optional(),
});

const moveTripsSchema = z.object({
  trip_ids: z.array(z.string().uuid()).optional(),
});

/**
 * POST /auth/otp/send
 * Send OTP to email
 */
router.post('/otp/send', async (req, res, next) => {
  try {
    const { email } = emailSchema.parse(req.body);
    await otpService.sendOTP(email);
    return successResponse(res, { message: 'OTP sent successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * POST /auth/otp/verify
 * Verify OTP and register/login
 */
router.post('/otp/verify', async (req, res, next) => {
  try {
    const { email, otp } = otpVerifySchema.parse(req.body);

    // Verify OTP
    const isValid = await otpService.verifyOTP(email, otp);
    if (!isValid) {
      return next(new ValidationError('Invalid OTP code'));
    }

    // Check if user exists
    let user = await userService.getUserByEmail(email);
    if (!user) {
      // Create new user (no password for OTP auth)
      user = await userService.createUser(email, undefined, 'email');
    }

    // Generate token
    const accessToken = userService.generateToken(user);
    const profile = await userService.getProfile(user.id);

    return successResponse(res, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 60 * 60,
      user,
      profile: profile || undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * POST /auth/register
 * Register new user with email/password
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const authToken = await userService.register(email, password, name);
    return successResponse(res, authToken, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * POST /auth/login
 * Login with email/password
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const authToken = await userService.login(email, password);
    return successResponse(res, authToken);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * GET /auth/google
 * Get Google OAuth URL
 */
router.get('/google', (req, res) => {
  const authUrl = googleOAuthService.getAuthUrl();
  return successResponse(res, { auth_url: authUrl });
});

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return next(new ValidationError('Authorization code is required'));
    }

    const authToken = await googleOAuthService.handleCallback(code);
    return successResponse(res, authToken);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticateUser, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new Error('User not found in request'));
    }

    const profile = await userService.getProfile(req.user.id);
    return successResponse(res, {
      user: req.user,
      profile: profile || undefined,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /auth/profile
 * Update user profile
 */
router.patch('/profile', authenticateUser, requireUser, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new Error('User not found in request'));
    }

    const updates = updateProfileSchema.parse(req.body);
    const profile = await userService.updateProfile(req.user.id, updates);
    return successResponse(res, profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

/**
 * POST /auth/guest/session
 * Create guest session
 */
router.post('/guest/session', async (req, res, next) => {
  try {
    const session = await guestService.createSession();
    return successResponse(res, session, 201);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/guest/move-trips
 * Move trips from guest session to user account
 */
router.post('/guest/move-trips', authenticateUser, requireUser, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new Error('User not found in request'));
    }

    const { trip_ids } = moveTripsSchema.parse(req.body);
    const guestSessionId = req.headers['x-guest-session-id'] as string;

    if (!guestSessionId) {
      return next(new ValidationError('Guest session ID is required'));
    }

    const movedCount = await guestService.moveTripsToAccount(
      guestSessionId,
      req.user.id,
      trip_ids
    );

    return successResponse(res, {
      message: `Successfully moved ${movedCount} trip(s) to account`,
      moved_count: movedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid request data', error.errors));
    }
    return next(error);
  }
});

export default router;

