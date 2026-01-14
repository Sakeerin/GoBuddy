import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse, ApiError } from '@/types';
import { AppError } from './errors';
import { logger } from './logger';
import { metricsService } from '@/services/observability/metrics.service';

export function successResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    meta: {
      request_id: res.locals.requestId || uuidv4(),
      timestamp: new Date().toISOString(),
    },
  };
  return res.status(statusCode).json(response);
}

export function errorResponse(
  res: Response,
  error: AppError | Error,
  statusCode?: number
): Response {
  const requestId = res.locals.requestId || uuidv4();

  let apiError: ApiError;
  let httpStatus: number;

  if (error instanceof AppError) {
    apiError = {
      code: error.code,
      message: error.message,
      details: error.details,
    };
    httpStatus = statusCode || error.statusCode;
  } else {
    apiError = {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
    };
    httpStatus = statusCode || 500;
  }

  // Log error
  logger.error('API Error', {
    requestId,
    error: apiError,
    stack: error.stack,
  });

  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: apiError,
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return res.status(httpStatus).json(response);
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: () => void
): void {
  res.locals.requestId = req.headers['x-request-id'] || uuidv4();
  next();
}

