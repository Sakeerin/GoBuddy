import { Request, Response, NextFunction } from 'express';
import { sharingService } from '@/services/sharing/sharing.service';
import { ForbiddenError } from '@/utils/errors';
import { ShareAccess } from '@/types/sharing';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      shareAccess?: ShareAccess;
    }
  }
}

/**
 * Middleware to authenticate via share token
 */
export async function authenticateShare(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const shareToken = req.query.token as string || req.headers['x-share-token'] as string;

    if (!shareToken) {
      return next(new ForbiddenError('Share token required'));
    }

    const { tripId } = req.params;
    if (!tripId) {
      return next(new ForbiddenError('Trip ID required'));
    }

    const access = await sharingService.checkAccess(tripId, undefined, shareToken);
    req.shareAccess = access;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission: 'view' | 'edit' | 'delete' | 'share') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const access = req.shareAccess || req.user ? {
      can_view: true,
      can_edit: true,
      can_delete: true,
      can_share: true,
    } : null;

    if (!access) {
      return next(new ForbiddenError('Access denied'));
    }

    const hasPermission =
      (permission === 'view' && access.can_view) ||
      (permission === 'edit' && access.can_edit) ||
      (permission === 'delete' && access.can_delete) ||
      (permission === 'share' && access.can_share);

    if (!hasPermission) {
      return next(new ForbiddenError(`Permission denied: ${permission} required`));
    }

    next();
  };
}

