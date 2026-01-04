import axios from 'axios';
import { RouteProvider, RouteRequest, RouteResponse } from '@/types/routing';
import { logger } from '@/utils/logger';
import { ExternalServiceError } from '@/utils/errors';

/**
 * Google Maps Directions API provider
 * TODO: Implement when Google Maps API key is available
 */
export class GoogleMapsRouteProvider implements RouteProvider {
  name = 'google';
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Google Maps API key not configured');
    }
  }

  async computeRoute(request: RouteRequest): Promise<RouteResponse> {
    if (!this.apiKey) {
      throw new ExternalServiceError('Google Maps', 'API key not configured');
    }

    try {
      const mode = this.mapModeToGoogleMode(request.mode);
      const params = new URLSearchParams({
        origin: `${request.from.lat},${request.from.lng}`,
        destination: `${request.to.lat},${request.to.lng}`,
        mode,
        key: this.apiKey,
      });

      if (request.departure_time && request.mode === 'transit') {
        params.append('departure_time', Math.floor(request.departure_time.getTime() / 1000).toString());
      }

      const response = await axios.get(`${this.baseUrl}?${params.toString()}`);

      if (response.data.status !== 'OK') {
        throw new ExternalServiceError(
          'Google Maps',
          `API returned status: ${response.data.status}`
        );
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];

      return {
        from: request.from,
        to: request.to,
        mode: request.mode,
        distance_km: leg.distance.value / 1000, // Convert meters to km
        duration_minutes: leg.duration.value / 60, // Convert seconds to minutes
        cost_estimate: this.estimateCost(leg.distance.value / 1000, request.mode),
        polyline: route.overview_polyline.points,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions,
          distance_km: step.distance.value / 1000,
          duration_minutes: step.duration.value / 60,
          mode: request.mode,
        })),
        provider: this.name,
        cached: false,
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError('Google Maps', 'Failed to compute route', error);
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  private mapModeToGoogleMode(mode: RouteRequest['mode']): string {
    const modeMap: Record<RouteRequest['mode'], string> = {
      walking: 'walking',
      transit: 'transit',
      taxi: 'driving', // Google doesn't have taxi mode, use driving
      drive: 'driving',
    };
    return modeMap[mode] || 'walking';
  }

  private estimateCost(distanceKm: number, mode: RouteRequest['mode']): { amount: number; currency: string } | undefined {
    // Google Maps doesn't provide cost, so we estimate
    switch (mode) {
      case 'transit':
        return {
          amount: Math.round(distanceKm * 2),
          currency: 'THB',
        };
      case 'taxi':
        return {
          amount: Math.round(35 + distanceKm * 7),
          currency: 'THB',
        };
      case 'drive':
        return {
          amount: Math.round(distanceKm * 3),
          currency: 'THB',
        };
      default:
        return undefined;
    }
  }
}

