import { query } from '@/config/database';
import { itineraryGeneratorService } from '@/services/itinerary/itinerary-generator.service';
import { tripService } from '@/services/trip/trip.service';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import { Itinerary, ItineraryDay } from '@/types/itinerary';

export type CostCategory = 'accommodation' | 'activities' | 'transportation' | 'meals' | 'other';

export interface CostBreakdown {
  category: CostCategory;
  amount: number;
  currency: string;
  confidence: 'fixed' | 'estimated';
  items: Array<{
    name: string;
    amount: number;
    confidence: 'fixed' | 'estimated';
  }>;
}

export interface DayCostBreakdown {
  day: number;
  date: string;
  total: {
    amount: number;
    currency: string;
  };
  by_category: CostBreakdown[];
  items: Array<{
    item_id: string;
    name: string;
    category: CostCategory;
    amount: number;
    confidence: 'fixed' | 'estimated';
  }>;
}

export interface TotalCostBreakdown {
  total: {
    amount: number;
    currency: string;
  };
  by_category: CostBreakdown[];
  by_day: DayCostBreakdown[];
  summary: {
    accommodation_total: number;
    activities_total: number;
    transportation_total: number;
    meals_total: number;
    other_total: number;
  };
}

export class CostingService {
  /**
   * Calculate cost breakdown for itinerary
   */
  async calculateCostBreakdown(tripId: string): Promise<TotalCostBreakdown> {
    const itinerary = await itineraryGeneratorService.getItineraryByTripId(tripId);
    if (!itinerary) {
      throw new NotFoundError('Itinerary', tripId);
    }

    const { preferences } = await tripService.getTripWithPreferences(tripId);
    const currency = preferences.budget.currency;

    const byDay: DayCostBreakdown[] = [];
    const categoryTotals = new Map<CostCategory, number>();

    // Initialize category totals
    const categories: CostCategory[] = ['accommodation', 'activities', 'transportation', 'meals', 'other'];
    categories.forEach((cat) => categoryTotals.set(cat, 0));

    // Process each day
    for (const day of itinerary.days) {
      const dayBreakdown = await this.calculateDayCostBreakdown(day, currency);
      byDay.push(dayBreakdown);

      // Accumulate category totals
      for (const category of dayBreakdown.by_category) {
        const current = categoryTotals.get(category.category) || 0;
        categoryTotals.set(category.category, current + category.amount);
      }
    }

    // Build total breakdown
    const byCategory: CostBreakdown[] = categories.map((category) => {
      const amount = categoryTotals.get(category) || 0;
      return {
        category,
        amount,
        currency,
        confidence: this.determineConfidence(category, amount),
        items: [], // Will be populated if needed
      };
    });

    const total = byCategory.reduce((sum, cat) => sum + cat.amount, 0);

    return {
      total: {
        amount: total,
        currency,
      },
      by_category: byCategory,
      by_day: byDay,
      summary: {
        accommodation_total: categoryTotals.get('accommodation') || 0,
        activities_total: categoryTotals.get('activities') || 0,
        transportation_total: categoryTotals.get('transportation') || 0,
        meals_total: categoryTotals.get('meals') || 0,
        other_total: categoryTotals.get('other') || 0,
      },
    };
  }

  /**
   * Calculate cost breakdown for a single day
   */
  private async calculateDayCostBreakdown(
    day: ItineraryDay,
    currency: string
  ): Promise<DayCostBreakdown> {
    const categoryMap = new Map<CostCategory, CostBreakdown>();
    const items: DayCostBreakdown['items'] = [];

    // Initialize categories
    const categories: CostCategory[] = ['accommodation', 'activities', 'transportation', 'meals', 'other'];
    categories.forEach((cat) => {
      categoryMap.set(cat, {
        category: cat,
        amount: 0,
        currency,
        confidence: 'estimated',
        items: [],
      });
    });

    // Process each item
    for (const item of day.items) {
      const category = this.categorizeItem(item);
      const cost = item.cost_estimate?.amount || 0;
      const confidence = item.cost_estimate?.confidence || 'estimated';

      // Add to category
      const categoryBreakdown = categoryMap.get(category)!;
      categoryBreakdown.amount += cost;
      categoryBreakdown.items.push({
        name: item.name,
        amount: cost,
        confidence,
      });

      // Track item
      items.push({
        item_id: item.id,
        name: item.name,
        category,
        amount: cost,
        confidence,
      });

      // Add route cost if exists
      if (item.route_from_previous?.cost_estimate) {
        const routeCost = item.route_from_previous.cost_estimate.amount;
        const transportCategory = categoryMap.get('transportation')!;
        transportCategory.amount += routeCost;
        transportCategory.items.push({
          name: `Transport: ${item.route_from_previous.mode}`,
          amount: routeCost,
          confidence: 'estimated',
        });
      }
    }

    // Add meal estimates (if not already included)
    const mealEstimate = this.estimateMeals(day.items.length, currency);
    const mealCategory = categoryMap.get('meals')!;
    mealCategory.amount += mealEstimate;
    mealCategory.items.push({
      name: 'Meal estimate',
      amount: mealEstimate,
      confidence: 'estimated',
    });

    const total = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.amount, 0);

    return {
      day: day.day,
      date: day.date,
      total: {
        amount: total,
        currency,
      },
      by_category: Array.from(categoryMap.values()),
      items,
    };
  }

  /**
   * Categorize an item
   */
  private categorizeItem(item: ItineraryDay['items'][0]): CostCategory {
    switch (item.item_type) {
      case 'hotel':
        return 'accommodation';
      case 'activity':
      case 'poi':
        return 'activities';
      case 'transport':
        return 'transportation';
      case 'meal':
        return 'meals';
      default:
        return 'other';
    }
  }

  /**
   * Estimate meal costs
   */
  private estimateMeals(numActivities: number, currency: string): number {
    // Rough estimate: 3 meals per day
    // Breakfast: 100, Lunch: 200, Dinner: 300 (in THB)
    const mealCosts = {
      THB: { breakfast: 100, lunch: 200, dinner: 300 },
      USD: { breakfast: 3, lunch: 6, dinner: 9 },
      EUR: { breakfast: 3, lunch: 6, dinner: 9 },
    };

    const costs = mealCosts[currency as keyof typeof mealCosts] || mealCosts.THB;
    return costs.breakfast + costs.lunch + costs.dinner;
  }

  /**
   * Determine confidence level for category
   */
  private determineConfidence(category: CostCategory, amount: number): 'fixed' | 'estimated' {
    // For MVP, most costs are estimated
    // In future, can check if items are booked (fixed) or estimated
    return 'estimated';
  }

  /**
   * Convert currency (stub implementation)
   * TODO: Integrate with currency conversion API
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Stub conversion rates (for MVP)
    // In production, use real-time exchange rates
    const rates: Record<string, number> = {
      'THB:USD': 0.028,
      'USD:THB': 35.5,
      'THB:EUR': 0.026,
      'EUR:THB': 38.5,
      'USD:EUR': 0.92,
      'EUR:USD': 1.09,
    };

    const rateKey = `${fromCurrency}:${toCurrency}`;
    const rate = rates[rateKey] || 1;

    return Math.round(amount * rate * 100) / 100;
  }

  /**
   * Update costs when prices change
   */
  async updateItemCost(
    tripId: string,
    itemId: string,
    newCost: { amount: number; currency: string; confidence: 'fixed' | 'estimated' }
  ): Promise<void> {
    await query(
      `UPDATE itinerary_items
       SET cost_estimate = $1, updated_at = NOW()
       WHERE id = $2 AND trip_id = $3`,
      [JSON.stringify(newCost), itemId, tripId]
    );

    logger.info('Item cost updated', { tripId, itemId, newCost });
  }
}

export const costingService = new CostingService();

