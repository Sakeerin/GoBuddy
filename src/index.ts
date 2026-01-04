import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { requestIdMiddleware, errorResponse } from '@/utils/response';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import authRoutes from '@/routes/auth.routes';
import tripRoutes from '@/routes/trip.routes';
import poiRoutes from '@/routes/poi.routes';
import itineraryRoutes from '@/routes/itinerary.routes';
import routingRoutes from '@/routes/routing.routes';
import costingRoutes from '@/routes/costing.routes';
import bookingRoutes from '@/routes/booking.routes';
import replanRoutes from '@/routes/replan.routes';
import { providerRegistry } from '@/services/providers/provider-registry';
import { StubActivityProvider } from '@/services/providers/stub-activity.provider';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register providers
const stubActivityProvider = new StubActivityProvider();
providerRegistry.register('stub-activity', stubActivityProvider);

// Routes
app.use('/auth', authRoutes);
app.use('/trips', tripRoutes);
app.use('/trips', itineraryRoutes);
app.use('/trips', routingRoutes);
app.use('/trips', costingRoutes);
app.use('/trips', bookingRoutes);
app.use('/routing', routingRoutes);
app.use('/costing', costingRoutes);
app.use('/pois', poiRoutes);
app.use('/providers', bookingRoutes);
app.use('/webhooks', bookingRoutes);
app.use('/trips', replanRoutes);

// 404 handler
app.use((req, res) => {
  errorResponse(res, new AppError('NOT_FOUND', 'Route not found', 404));
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  errorResponse(res, err);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

