import { v4 as uuidv4 } from 'uuid';
import { query } from '@/config/database';
import { getRedisClient } from '@/config/redis';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import { POI, POISearchFilters, POISearchResult } from '@/types/poi';

export class POIService {
  /**
   * Search POIs with filters
   */
  async search(filters: POISearchFilters): Promise<POISearchResult> {
    const page = filters.page || 1;
    const perPage = Math.min(filters.per_page || 20, 100); // Max 100 per page
    const offset = (page - 1) * perPage;

    // Build query
    let queryText = 'SELECT * FROM pois WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    // Text search
    if (filters.q) {
      queryText += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${filters.q}%`);
      paramIndex++;
    }

    // Location filter (simple distance check - for production, use PostGIS)
    if (filters.location) {
      // For MVP, we'll do a simple bounding box check
      // In production, use PostGIS ST_DWithin for proper distance calculation
      const radius = filters.location.radius_km || 10;
      const lat = filters.location.lat;
      const lng = filters.location.lng;

      // Approximate bounding box (1 degree ≈ 111 km)
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos(lat * Math.PI / 180));

      queryText += ` AND 
        (location->>'lat')::float BETWEEN $${paramIndex} AND $${paramIndex + 1} AND
        (location->>'lng')::float BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}`;
      params.push(lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta);
      paramIndex += 4;
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      queryText += ` AND tags && $${paramIndex}::text[]`;
      params.push(filters.tags);
      paramIndex++;
    }

    // Budget range filter
    if (filters.budget_range) {
      if (filters.budget_range.min !== undefined) {
        queryText += ` AND (price_range->>'min')::float >= $${paramIndex}`;
        params.push(filters.budget_range.min);
        paramIndex++;
      }
      if (filters.budget_range.max !== undefined) {
        queryText += ` AND (price_range->>'max')::float <= $${paramIndex}`;
        params.push(filters.budget_range.max);
        paramIndex++;
      }
    }

    // Kid friendly filter
    if (filters.kid_friendly) {
      queryText += ` AND 'kid_friendly' = ANY(tags)`;
    }

    // Open now filter (simplified - checks if current time is within hours)
    if (filters.open_now) {
      const now = new Date();
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      const currentTime = now.toTimeString().slice(0, 5); // HH:mm format

      queryText += ` AND 
        hours->$${paramIndex}->>'closed' IS DISTINCT FROM 'true' AND
        hours->$${paramIndex}->>'open' <= $${paramIndex + 1} AND
        hours->$${paramIndex}->>'close' >= $${paramIndex + 1}`;
      params.push(dayOfWeek, currentTime);
      paramIndex += 2;
    }

    // Get total count
    const countQuery = queryText.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination
    queryText += ` ORDER BY rating DESC NULLS LAST, name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(perPage, offset);

    const result = await query(queryText, params);
    const pois = result.rows.map((row) => this.mapRowToPOI(row));

    return {
      pois,
      total,
      page,
      per_page: perPage,
    };
  }

  /**
   * Get POI by ID
   */
  async getPOIById(poiId: string): Promise<POI> {
    // Try cache first
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(`poi:${poiId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn('Redis cache miss for POI', { poiId, error: err });
    }

    const result = await query(
      `SELECT * FROM pois WHERE id = $1`,
      [poiId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('POI', poiId);
    }

    const poi = this.mapRowToPOI(result.rows[0]);

    // Cache for 1 hour
    try {
      const redis = await getRedisClient();
      await redis.setEx(`poi:${poiId}`, 3600, JSON.stringify(poi));
    } catch (err) {
      logger.warn('Failed to cache POI', { poiId, error: err });
    }

    return poi;
  }

  /**
   * Get POI by place_id (external provider ID)
   */
  async getPOIByPlaceId(placeId: string, provider: string): Promise<POI | null> {
    const result = await query(
      `SELECT * FROM pois WHERE place_id = $1 AND provider = $2`,
      [placeId, provider]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPOI(result.rows[0]);
  }

  /**
   * Create or update POI
   */
  async upsertPOI(poiData: Omit<POI, 'id' | 'created_at' | 'updated_at'>): Promise<POI> {
    // Check if POI exists by place_id
    const existing = await this.getPOIByPlaceId(poiData.place_id, poiData.provider);

    if (existing) {
      // Update existing POI
      const result = await query(
        `UPDATE pois SET
          name = $1,
          description = $2,
          location = $3,
          hours = $4,
          tags = $5,
          avg_duration_minutes = $6,
          price_range = $7,
          rating = $8,
          rating_count = $9,
          images = $10,
          website_url = $11,
          phone = $12,
          updated_at = NOW()
        WHERE id = $13
        RETURNING *`,
        [
          poiData.name,
          poiData.description || null,
          JSON.stringify(poiData.location),
          poiData.hours ? JSON.stringify(poiData.hours) : null,
          poiData.tags,
          poiData.avg_duration_minutes,
          poiData.price_range ? JSON.stringify(poiData.price_range) : null,
          poiData.rating || null,
          poiData.rating_count || null,
          poiData.images || null,
          poiData.website_url || null,
          poiData.phone || null,
          existing.id,
        ]
      );

      const poi = this.mapRowToPOI(result.rows[0]);

      // Invalidate cache
      try {
        const redis = await getRedisClient();
        await redis.del(`poi:${poi.id}`);
      } catch (err) {
        logger.warn('Failed to invalidate POI cache', { poiId: poi.id, error: err });
      }

      return poi;
    } else {
      // Create new POI
      const result = await query(
        `INSERT INTO pois (
          place_id, name, description, location, hours, tags,
          avg_duration_minutes, price_range, rating, rating_count,
          images, website_url, phone, provider
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          poiData.place_id,
          poiData.name,
          poiData.description || null,
          JSON.stringify(poiData.location),
          poiData.hours ? JSON.stringify(poiData.hours) : null,
          poiData.tags,
          poiData.avg_duration_minutes,
          poiData.price_range ? JSON.stringify(poiData.price_range) : null,
          poiData.rating || null,
          poiData.rating_count || null,
          poiData.images || null,
          poiData.website_url || null,
          poiData.phone || null,
          poiData.provider,
        ]
      );

      return this.mapRowToPOI(result.rows[0]);
    }
  }

  /**
   * Add POI to trip (creates association - to be implemented in itinerary service)
   * This is a placeholder for future implementation
   */
  async addPOIToTrip(poiId: string, tripId: string): Promise<void> {
    // This will be implemented when we build the itinerary service
    // For now, just validate that POI exists
    await this.getPOIById(poiId);
    logger.info('POI added to trip', { poiId, tripId });
  }

  private mapRowToPOI(row: any): POI {
    const location = typeof row.location === 'string'
      ? JSON.parse(row.location)
      : row.location;

    const hours = row.hours
      ? (typeof row.hours === 'string' ? JSON.parse(row.hours) : row.hours)
      : undefined;

    const priceRange = row.price_range
      ? (typeof row.price_range === 'string' ? JSON.parse(row.price_range) : row.price_range)
      : undefined;

    return {
      id: row.id,
      place_id: row.place_id,
      name: row.name,
      description: row.description,
      location,
      hours,
      tags: row.tags || [],
      avg_duration_minutes: row.avg_duration_minutes,
      price_range: priceRange,
      rating: row.rating ? parseFloat(row.rating) : undefined,
      rating_count: row.rating_count,
      images: row.images || undefined,
      website_url: row.website_url,
      phone: row.phone,
      provider: row.provider,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const poiService = new POIService();

