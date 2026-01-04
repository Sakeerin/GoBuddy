import { RouteProvider, RouteRequest, RouteResponse } from '@/types/routing';

/**
 * Stub routing provider for MVP
 * Uses simple distance calculation and estimated times/costs
 */
export class StubRouteProvider implements RouteProvider {
  name = 'stub';

  async computeRoute(request: RouteRequest): Promise<RouteResponse> {
    const distance = this.calculateDistance(
      request.from.lat,
      request.from.lng,
      request.to.lat,
      request.to.lng
    );

    const { duration, cost } = this.estimateTimeAndCost(distance, request.mode);

    return {
      from: request.from,
      to: request.to,
      mode: request.mode,
      distance_km: distance,
      duration_minutes: duration,
      cost_estimate: cost,
      provider: this.name,
      cached: false,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true; // Stub is always available
  }

  /**
   * Calculate distance using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Estimate time and cost based on mode
   */
  private estimateTimeAndCost(
    distanceKm: number,
    mode: RouteRequest['mode']
  ): { duration: number; cost?: { amount: number; currency: string } } {
    switch (mode) {
      case 'walking':
        // Average walking speed: 5 km/h
        return {
          duration: Math.round(distanceKm / 5 * 60),
          cost: undefined, // Walking is free
        };

      case 'transit':
        // Average transit speed: 20 km/h (including waiting/transfers)
        return {
          duration: Math.round(distanceKm / 20 * 60),
          cost: {
            amount: Math.round(distanceKm * 2), // ~2 THB per km
            currency: 'THB',
          },
        };

      case 'taxi':
        // Average taxi speed: 30 km/h in city
        return {
          duration: Math.round(distanceKm / 30 * 60),
          cost: {
            amount: Math.round(35 + distanceKm * 7), // 35 THB base + 7 THB per km
            currency: 'THB',
          },
        };

      case 'drive':
        // Average driving speed: 40 km/h in city
        return {
          duration: Math.round(distanceKm / 40 * 60),
          cost: {
            amount: Math.round(distanceKm * 3), // ~3 THB per km (fuel)
            currency: 'THB',
          },
        };

      default:
        return {
          duration: Math.round(distanceKm / 5 * 60),
        };
    }
  }
}

