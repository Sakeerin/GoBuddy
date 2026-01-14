import { Request, Response, NextFunction } from 'express';
import { adminService } from '@/services/admin/admin.service';
import { ForbiddenError } from '@/utils/errors';

/**
 * Middleware to require admin access
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new ForbiddenError('Authentication required'));
    }

    const isAdmin = await adminService.isAdmin(userId);
    if (!isAdmin) {
      return next(new ForbiddenError('Admin access required'));
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require specific admin permission
 */
export function requireAdminPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new ForbiddenError('Authentication required'));
      }

      await adminService.requirePermission(userId, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}
