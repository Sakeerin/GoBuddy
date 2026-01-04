import axios from 'axios';
import { logger } from '@/utils/logger';
import { ExternalServiceError } from '@/utils/errors';
import { WeatherEventDetails, EventSeverity } from '@/types/events';

/**
 * Weather service to fetch weather data from external APIs
 * For MVP, uses OpenWeatherMap API (stub implementation)
 */
export class WeatherService {
  private apiKey: string;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENWEATHER_API_KEY || '';
  }

  /**
   * Get weather forecast for location and time
   */
  async getWeatherForecast(
    lat: number,
    lng: number,
    date: Date
  ): Promise<{
    condition: string;
    severity: EventSeverity;
    details: WeatherEventDetails;
  }> {
    if (!this.apiKey) {
      // Stub implementation for MVP
      return this.getStubWeather(lat, lng, date);
    }

    try {
      // Use OpenWeatherMap API
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric',
        },
      });

      // Find forecast for the specific date/time
      const forecasts = response.data.list;
      const targetTime = date.getTime() / 1000; // Unix timestamp

      let closestForecast = forecasts[0];
      let minDiff = Math.abs(closestForecast.dt - targetTime);

      for (const forecast of forecasts) {
        const diff = Math.abs(forecast.dt - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestForecast = forecast;
        }
      }

      const weather = closestForecast.weather[0];
      const main = closestForecast.main;
      const wind = closestForecast.wind;

      // Determine condition and severity
      const condition = this.mapWeatherCode(weather.main, weather.description);
      const severity = this.determineSeverity(condition, closestForecast.rain, closestForecast.snow);

      return {
        condition,
        severity,
        details: {
          condition,
          temperature: main.temp,
          humidity: main.humidity,
          wind_speed: wind?.speed,
          impact: this.determineImpact(condition, severity),
        },
      };
    } catch (error) {
      logger.warn('Weather API failed, using stub', { error });
      return this.getStubWeather(lat, lng, date);
    }
  }

  /**
   * Stub weather implementation for MVP
   */
  private getStubWeather(
    lat: number,
    lng: number,
    date: Date
  ): {
    condition: string;
    severity: EventSeverity;
    details: WeatherEventDetails;
  } {
    // Simple stub: randomly return weather conditions
    const conditions = ['sunny', 'light_rain', 'heavy_rain', 'cloudy'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const severity: EventSeverity = condition === 'heavy_rain' ? 'high' : condition === 'light_rain' ? 'medium' : 'low';

    return {
      condition,
      severity,
      details: {
        condition,
        temperature: 28,
        humidity: 70,
        wind_speed: 10,
        impact: this.determineImpact(condition, severity),
      },
    };
  }

  /**
   * Map weather code to condition
   */
  private mapWeatherCode(main: string, description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('heavy rain') || desc.includes('torrential')) {
      return 'heavy_rain';
    }
    if (desc.includes('rain') || desc.includes('drizzle')) {
      return 'light_rain';
    }
    if (desc.includes('snow')) {
      return 'snow';
    }
    if (desc.includes('clear') || desc.includes('sun')) {
      return 'sunny';
    }
    if (desc.includes('cloud')) {
      return 'cloudy';
    }

    return main.toLowerCase();
  }

  /**
   * Determine severity based on condition and precipitation
   */
  private determineSeverity(
    condition: string,
    rain?: { '1h'?: number },
    snow?: { '1h'?: number }
  ): EventSeverity {
    if (condition === 'heavy_rain') {
      return 'high';
    }

    const rainAmount = rain?.['1h'] || 0;
    const snowAmount = snow?.['1h'] || 0;

    if (rainAmount > 10 || snowAmount > 5) {
      return 'high';
    }
    if (rainAmount > 0 || snowAmount > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Determine impact description
   */
  private determineImpact(condition: string, severity: EventSeverity): string {
    if (condition === 'heavy_rain' && severity === 'high') {
      return 'outdoor_activities_affected';
    }
    if (condition === 'light_rain' && severity === 'medium') {
      return 'outdoor_activities_may_be_affected';
    }
    return 'no_significant_impact';
  }
}

export const weatherService = new WeatherService();

