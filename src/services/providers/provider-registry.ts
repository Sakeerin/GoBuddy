import { ProviderAdapter } from './provider-adapter.interface';
import { logger } from '@/utils/logger';

export class ProviderRegistry {
  private providers: Map<string, ProviderAdapter> = new Map();

  /**
   * Register a provider
   */
  register(providerId: string, adapter: ProviderAdapter): void {
    this.providers.set(providerId, adapter);
    logger.info('Provider registered', { providerId });
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): ProviderAdapter | null {
    return this.providers.get(providerId) || null;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Map<string, ProviderAdapter> {
    return new Map(this.providers);
  }

  /**
   * Check if provider exists
   */
  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Unregister provider
   */
  unregister(providerId: string): void {
    this.providers.delete(providerId);
    logger.info('Provider unregistered', { providerId });
  }
}

export const providerRegistry = new ProviderRegistry();

