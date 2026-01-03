# Provider Integration Document
## GoBuddy - Provider Adapter Interface & Mapping

### Provider Adapter Interface

All providers must implement the following interface:

```typescript
interface ProviderAdapter {
  // Search/Query
  search(options: SearchOptions): Promise<SearchResult[]>;
  getDetails(id: string): Promise<ItemDetails>;
  
  // Availability
  checkAvailability(id: string, date: string, travelers: TravelerCount): Promise<Availability>;
  
  // Booking
  createBooking(request: BookingRequest): Promise<BookingResponse>;
  getBookingStatus(bookingId: string): Promise<BookingStatus>;
  cancelBooking(bookingId: string): Promise<CancelResponse>;
  
  // Webhooks
  handleWebhook(payload: unknown): Promise<WebhookEvent>;
  
  // Health check
  healthCheck(): Promise<boolean>;
}
```

### Provider Types

#### 1. Activity Providers
- **Examples**: GetYourGuide, Viator, Klook, KKday
- **Capabilities**: 
  - Search activities by location/category
  - Check availability by date/time
  - Book tickets with instant confirmation
  - Voucher generation

#### 2. Hotel Providers
- **Examples**: Booking.com, Agoda, Expedia, Hotels.com
- **Capabilities**:
  - Search hotels by location/dates
  - Check room availability
  - Book rooms with confirmation
  - Cancellation policies

#### 3. Transport Providers (Future)
- **Examples**: Train APIs, Bus APIs, Flight APIs
- **Capabilities**:
  - Search routes
  - Check schedules
  - Book tickets

### Provider Configuration

```typescript
interface ProviderConfig {
  provider_id: string;
  provider_name: string;
  provider_type: 'activity' | 'hotel' | 'transport';
  api_credentials: {
    api_key: string; // encrypted at rest
    api_secret?: string;
    base_url: string;
  };
  webhook_config: {
    endpoint_url: string;
    secret: string;
  };
  commission_rules: {
    rate: number; // percentage
    calculation: 'percentage' | 'fixed';
  };
  retry_config: {
    max_retries: number;
    backoff_strategy: 'exponential' | 'linear';
  };
  rate_limits: {
    requests_per_minute: number;
    requests_per_day: number;
  };
  enabled: boolean;
}
```

### Error Mapping

```typescript
interface ProviderError {
  provider_code: string;
  provider_message: string;
  gobuddy_code: string; // Mapped to standard error codes
  retryable: boolean;
  details?: unknown;
}
```

**Standard Error Codes:**
- `PROVIDER_UNAVAILABLE`: Provider service down
- `PROVIDER_TIMEOUT`: Request timeout
- `PROVIDER_RATE_LIMIT`: Rate limit exceeded
- `PROVIDER_AUTH_ERROR`: Authentication failed
- `PROVIDER_NOT_FOUND`: Item not found
- `PROVIDER_SOLD_OUT`: Item sold out
- `PROVIDER_PRICE_CHANGED`: Price changed
- `PROVIDER_BOOKING_FAILED`: Booking failed

### Booking Request/Response

```typescript
interface BookingRequest {
  provider_item_id: string;
  date: string;
  time_slot?: string;
  travelers: {
    adults: number;
    children?: number;
    seniors?: number;
  };
  contact_info: {
    email: string;
    phone?: string;
    name: string;
  };
  idempotency_key: string;
}

interface BookingResponse {
  booking_id: string; // Provider's booking ID
  status: 'confirmed' | 'pending';
  price: {
    amount: number;
    currency: string;
  };
  voucher_url?: string;
  voucher_data?: string; // Base64 encoded voucher
  policies: {
    cancellation: string;
    refund: string;
    cancellation_deadline?: string;
  };
  confirmation_number: string;
  expires_at?: string; // For pending bookings
}
```

### Webhook Events

```typescript
interface WebhookEvent {
  event_type: 'booking_confirmed' | 'booking_canceled' | 'price_changed' | 'availability_changed';
  provider_booking_id: string;
  gobuddy_booking_id?: string;
  timestamp: string;
  payload: unknown;
}
```

### Provider Adapter Implementation Example

```typescript
class GetYourGuideAdapter implements ProviderAdapter {
  private config: ProviderConfig;
  private client: HttpClient;
  
  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new HttpClient(config.api_credentials.base_url, {
      headers: {
        'Authorization': `Bearer ${config.api_credentials.api_key}`
      }
    });
  }
  
  async search(options: SearchOptions): Promise<SearchResult[]> {
    try {
      const response = await this.client.get('/activities', {
        params: {
          location: options.location,
          category: options.category,
          date: options.date
        }
      });
      
      return response.data.map(this.mapToSearchResult);
    } catch (error) {
      throw this.mapError(error);
    }
  }
  
  async createBooking(request: BookingRequest): Promise<BookingResponse> {
    // Check idempotency
    const existing = await this.checkIdempotency(request.idempotency_key);
    if (existing) {
      return existing;
    }
    
    try {
      const response = await this.client.post('/bookings', {
        activity_id: request.provider_item_id,
        date: request.date,
        time_slot: request.time_slot,
        travelers: request.travelers,
        contact: request.contact_info
      });
      
      const booking = this.mapToBookingResponse(response.data);
      
      // Store idempotency mapping
      await this.storeIdempotency(request.idempotency_key, booking.booking_id);
      
      return booking;
    } catch (error) {
      throw this.mapError(error);
    }
  }
  
  private mapError(error: unknown): ProviderError {
    // Map provider-specific errors to standard codes
    // ...
  }
}
```

### Provider Registry

```typescript
class ProviderRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();
  
  register(providerId: string, adapter: ProviderAdapter): void {
    this.adapters.set(providerId, adapter);
  }
  
  get(providerId: string): ProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Provider ${providerId} not found`);
    }
    return adapter;
  }
  
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map();
    for (const [id, adapter] of this.adapters.entries()) {
      try {
        const healthy = await adapter.healthCheck();
        results.set(id, healthy);
      } catch {
        results.set(id, false);
      }
    }
    return results;
  }
}
```

### Fallback Strategy

```typescript
class ProviderFallback {
  async bookWithFallback(
    itemId: string,
    request: BookingRequest,
    preferredProviders: string[]
  ): Promise<BookingResponse> {
    for (const providerId of preferredProviders) {
      try {
        const adapter = this.registry.get(providerId);
        const availability = await adapter.checkAvailability(
          itemId,
          request.date,
          request.travelers
        );
        
        if (availability.available) {
          return await adapter.createBooking(request);
        }
      } catch (error) {
        // Log and try next provider
        this.logger.warn(`Provider ${providerId} failed, trying next`, error);
        continue;
      }
    }
    
    throw new Error('All providers failed');
  }
}
```

### MVP Provider Priority

**Phase 1 (MVP):**
1. **Activities**: GetYourGuide หรือ Klook (เลือก 1 ตัว)
2. **Hotels**: Booking.com หรือ Agoda (เลือก 1 ตัว)

**Phase 2:**
- เพิ่ม provider อีกประเภท
- เพิ่ม provider หลายตัวในประเภทเดียวกัน (fallback)

### Testing Providers

```typescript
// Mock provider for testing
class MockProviderAdapter implements ProviderAdapter {
  async createBooking(request: BookingRequest): Promise<BookingResponse> {
    return {
      booking_id: `mock_${Date.now()}`,
      status: 'confirmed',
      price: { amount: 1000, currency: 'THB' },
      policies: {
        cancellation: 'free_until_24h',
        refund: 'full_refund'
      },
      confirmation_number: 'MOCK123',
      voucher_url: 'https://mock.voucher.url'
    };
  }
  // ... other methods
}
```

