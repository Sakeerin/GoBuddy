import { bookingService } from './booking.service';
import { providerRegistry } from '../providers/provider-registry';
import { poiService } from '@/services/poi/poi.service';
import { logger } from '@/utils/logger';
import { BookingOption } from '@/types/booking';
import { SearchOptions } from '../providers/provider-adapter.interface';

/**
 * Service to find alternative booking options when primary booking fails
 */
export class BookingAlternativesService {
  /**
   * Find alternative options for a failed booking
   */
  async findAlternatives(
    bookingId: string,
    maxAlternatives: number = 3
  ): Promise<BookingOption[]> {
    const booking = await bookingService.getBookingById(bookingId);

    // Get original item location if available
    let location: SearchOptions['location'] | undefined;
    if (booking.itinerary_item_id) {
      // TODO: Get location from itinerary item
      // For now, use a default location
    }

    const alternatives: BookingOption[] = [];

    // Try same provider first
    const provider = providerRegistry.getProvider(booking.provider_id);
    if (provider) {
      try {
        const searchResults = await provider.search({
          location,
          date: booking.booking_date,
          travelers: {
            adults: booking.traveler_details.adults,
            children: booking.traveler_details.children,
          },
        });

        // Convert to booking options
        for (const result of searchResults.slice(0, maxAlternatives)) {
          const details = await provider.getDetails(result.id);
          const availability = await provider.checkAvailability(
            result.id,
            booking.booking_date,
            booking.traveler_details
          );

          if (availability.available) {
            alternatives.push({
              id: result.id,
              name: result.name,
              description: result.description,
              price: result.price,
              availability,
              policies: details.policies,
              provider: booking.provider_id,
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to get alternatives from same provider', { error });
      }
    }

    // Try other providers if not enough alternatives
    if (alternatives.length < maxAlternatives) {
      const allProviders = providerRegistry.getAllProviders();
      for (const [providerId, providerAdapter] of allProviders.entries()) {
        if (providerId === booking.provider_id) continue;
        if (alternatives.length >= maxAlternatives) break;

        try {
          const searchResults = await providerAdapter.search({
            location,
            date: booking.booking_date,
            travelers: {
              adults: booking.traveler_details.adults,
              children: booking.traveler_details.children,
            },
          });

          for (const result of searchResults) {
            if (alternatives.length >= maxAlternatives) break;

            const details = await providerAdapter.getDetails(result.id);
            const availability = await providerAdapter.checkAvailability(
              result.id,
              booking.booking_date,
              booking.traveler_details
            );

            if (availability.available) {
              alternatives.push({
                id: result.id,
                name: result.name,
                description: result.description,
                price: result.price,
                availability,
                policies: details.policies,
                provider: providerId,
              });
            }
          }
        } catch (error) {
          logger.warn(`Failed to get alternatives from provider ${providerId}`, { error });
        }
      }
    }

    // Sort by price similarity to original
    const originalPrice = booking.price.amount;
    alternatives.sort((a, b) => {
      const diffA = Math.abs(a.price.amount - originalPrice);
      const diffB = Math.abs(b.price.amount - originalPrice);
      return diffA - diffB;
    });

    return alternatives.slice(0, maxAlternatives);
  }

  /**
   * Find similar POIs that could replace a failed booking
   */
  async findSimilarPOIs(
    poiId: string,
    location?: { lat: number; lng: number },
    maxResults: number = 5
  ): Promise<Array<{ poi_id: string; name: string; similarity_score: number }>> {
    try {
      const originalPOI = await poiService.getPOIById(poiId);

      // Search nearby POIs with similar tags
      const searchResults = await poiService.search({
        location: location || originalPOI.location,
        radius_km: 5,
        tags: originalPOI.tags.slice(0, 2), // Use first 2 tags
        page: 1,
        per_page: maxResults + 1, // +1 to exclude original
      });

      // Filter out original and calculate similarity
      const similar = searchResults.pois
        .filter((poi) => poi.id !== poiId)
        .map((poi) => {
          // Simple similarity score based on shared tags
          const sharedTags = poi.tags.filter((tag) => originalPOI.tags.includes(tag)).length;
          const similarityScore = sharedTags / Math.max(originalPOI.tags.length, poi.tags.length);

          return {
            poi_id: poi.id,
            name: poi.name,
            similarity_score: similarityScore,
          };
        })
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, maxResults);

      return similar;
    } catch (error) {
      logger.error('Failed to find similar POIs', { poiId, error });
      return [];
    }
  }
}

export const bookingAlternativesService = new BookingAlternativesService();

