import { Request, Response, NextFunction } from 'express';
import { metricsService } from '@/services/observability/metrics.service';

/**
 * Middleware to track API metrics
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    metricsService.recordRequest(responseTime, isError);
  });

  next();
}
