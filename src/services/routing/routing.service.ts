import { getRedisClient } from '@/config/redis';
import { logger } from '@/utils/logger';
import { ExternalServiceError } from '@/utils/errors';
import {
  RouteRequest,
  RouteResponse,
  RouteProvider,
  TransportationMode,
} from '@/types/routing';
import { StubRouteProvider } from './providers/stub-route.provider';

export class RoutingService {
  private providers: Map<string, RouteProvider> = new Map();
  private defaultProvider: RouteProvider;

  constructor() {
    // Register stub provider for MVP
    const stubProvider = new StubRouteProvider();
    this.providers.set('stub', stubProvider);
    this.defaultProvider = stubProvider;

    // TODO: Register real providers (Google Maps, OSRM, etc.)
    // const googleProvider = new GoogleMapsRouteProvider();
    // this.providers.set('google', googleProvider);
  }

  /**
   * Compute route between two points
   */
  async computeRoute(request: RouteRequest): Promise<RouteResponse> {
    // Check cache first
    const cached = await this.getCachedRoute(request);
    if (cached) {
      logger.debug('Route cache hit', { from: request.from, to: request.to });
      return { ...cached, cached: true };
    }

    // Try providers in order
    let lastError: Error | null = null;

    // Try default provider first
    try {
      const response = await this.defaultProvider.computeRoute(request);
      await this.cacheRoute(request, response);
      return { ...response, cached: false };
    } catch (error) {
      logger.warn('Default routing provider failed', { error });
      lastError = error as Error;
    }

    // Try other providers
    for (const [name, provider] of this.providers.entries()) {
      if (name === 'stub') continue; // Already tried

      try {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) continue;

        const response = await provider.computeRoute(request);
        await this.cacheRoute(request, response);
        return { ...response, cached: false };
      } catch (error) {
        logger.warn(`Routing provider ${name} failed`, { error });
        lastError = error as Error;
      }
    }

    // All providers failed, throw error
    throw new ExternalServiceError(
      'Routing',
      'All routing providers failed',
      { lastError: lastError?.message }
    );
  }

  /**
   * Compute route with specific provider
   */
  async computeRouteWithProvider(
    request: RouteRequest,
    providerName: string
  ): Promise<RouteResponse> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Routing provider ${providerName} not found`);
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new ExternalServiceError(
        'Routing',
        `Provider ${providerName} is not available`
      );
    }

    const response = await provider.computeRoute(request);
    await this.cacheRoute(request, response);
    return { ...response, cached: false };
  }

  /**
   * Update route mode for an itinerary item
   */
  async updateRouteMode(
    from: RouteRequest['from'],
    to: RouteRequest['to'],
    newMode: TransportationMode
  ): Promise<RouteResponse> {
    const request: RouteRequest = {
      from,
      to,
      mode: newMode,
    };

    return await this.computeRoute(request);
  }

  /**
   * Get cached route
   */
  private async getCachedRoute(request: RouteRequest): Promise<RouteResponse | null> {
    try {
      const redis = await getRedisClient();
      const cacheKey = this.getCacheKey(request);
      const cached = await redis.get(cacheKey);

      if (cached) {
        const route = JSON.parse(cached);
        // Verify it's still valid (cache for 1 hour)
        return route;
      }
    } catch (error) {
      logger.warn('Failed to get cached route', { error });
    }

    return null;
  }

  /**
   * Cache route result
   */
  private async cacheRoute(
    request: RouteRequest,
    response: RouteResponse
  ): Promise<void> {
    try {
      const redis = await getRedisClient();
      const cacheKey = this.getCacheKey(request);
      // Cache for 1 hour
      await redis.setEx(cacheKey, 3600, JSON.stringify(response));
    } catch (error) {
      logger.warn('Failed to cache route', { error });
      // Don't throw - caching is not critical
    }
  }

  /**
   * Generate cache key for route request
   */
  private getCacheKey(request: RouteRequest): string {
    // Round coordinates to 4 decimal places (~11 meters precision) for cache efficiency
    const fromLat = Math.round(request.from.lat * 10000) / 10000;
    const fromLng = Math.round(request.from.lng * 10000) / 10000;
    const toLat = Math.round(request.to.lat * 10000) / 10000;
    const toLng = Math.round(request.to.lng * 10000) / 10000;

    return `route:${fromLat},${fromLng}:${toLat},${toLng}:${request.mode}`;
  }

  /**
   * Register a new routing provider
   */
  registerProvider(name: string, provider: RouteProvider): void {
    this.providers.set(name, provider);
    logger.info('Routing provider registered', { name });
  }

  /**
   * Set default provider
   */
  setDefaultProvider(name: string): void {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }
    this.defaultProvider = provider;
    logger.info('Default routing provider changed', { name });
  }

  /**
   * Get list of available providers
   */
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];

    for (const [name, provider] of this.providers.entries()) {
      try {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          available.push(name);
        }
      } catch (error) {
        logger.warn(`Failed to check provider ${name} availability`, { error });
      }
    }

    return available;
  }
}

export const routingService = new RoutingService();

