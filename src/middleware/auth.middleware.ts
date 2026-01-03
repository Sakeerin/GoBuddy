import { Request, Response, NextFunction } from 'express';
import { userService } from '@/services/auth/user.service';
import { guestService } from '@/services/auth/guest.service';
import { UnauthorizedError } from '@/utils/errors';
import { User, UserProfile } from '@/types/user';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      profile?: UserProfile;
      guestSessionId?: string;
    }
  }
}

/**
 * Middleware to authenticate user via JWT token
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    const user = await userService.verifyToken(token);
    const profile = await userService.getProfile(user.id);

    req.user = user;
    req.profile = profile || undefined;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to authenticate user OR guest session
 */
export async function authenticateUserOrGuest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Try to authenticate as user first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const user = await userService.verifyToken(token);
        const profile = await userService.getProfile(user.id);

        req.user = user;
        req.profile = profile || undefined;
        return next();
      } catch {
        // If token is invalid, continue to check guest session
      }
    }

    // Check for guest session
    const guestSessionId = req.headers['x-guest-session-id'] as string;
    if (guestSessionId) {
      const isValid = await guestService.validateSession(guestSessionId);
      if (isValid) {
        req.guestSessionId = guestSessionId;
        return next();
      }
    }

    throw new UnauthorizedError('Authentication required');
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require authenticated user (not guest)
 */
export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new UnauthorizedError('User authentication required'));
  }
  next();
}

