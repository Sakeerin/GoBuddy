// Routing types

export type TransportationMode = 'walking' | 'transit' | 'taxi' | 'drive';

export interface RouteRequest {
  from: {
    lat: number;
    lng: number;
    address?: string;
  };
  to: {
    lat: number;
    lng: number;
    address?: string;
  };
  mode: TransportationMode;
  departure_time?: Date; // For transit routing
}

export interface RouteResponse {
  from: RouteRequest['from'];
  to: RouteRequest['to'];
  mode: TransportationMode;
  distance_km: number;
  duration_minutes: number;
  cost_estimate?: {
    amount: number;
    currency: string;
  };
  polyline?: string; // Encoded polyline for map display
  steps?: RouteStep[];
  provider: string; // Which provider was used
  cached: boolean;
}

export interface RouteStep {
  instruction: string;
  distance_km: number;
  duration_minutes: number;
  mode: TransportationMode;
}

export interface RouteProvider {
  name: string;
  computeRoute(request: RouteRequest): Promise<RouteResponse>;
  isAvailable(): Promise<boolean>;
}

