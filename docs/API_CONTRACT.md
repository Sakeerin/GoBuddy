# API Contract Document
## GoBuddy - API Endpoints & Schemas

### Base URL
```
Production: https://api.gobuddy.com/v1
Staging: https://api-staging.gobuddy.com/v1
```

### Authentication
All authenticated endpoints require:
```
Authorization: Bearer <token>
```

### Common Headers
```
Content-Type: application/json
X-Idempotency-Key: <uuid> (required for write operations)
X-Request-ID: <uuid> (for tracing)
```

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO8601"
  }
}
```

### Error Format
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "meta": { ... }
}
```

## Core Endpoints

### Trip Management

#### POST /trips
Create a new trip

**Request:**
```json
{
  "destination": {
    "city": "Bangkok",
    "country": "Thailand",
    "coordinates": { "lat": 13.7563, "lng": 100.5018 }
  },
  "dates": {
    "start": "2024-03-01",
    "end": "2024-03-05"
  },
  "travelers": {
    "adults": 2,
    "children": 0,
    "seniors": 0
  },
  "budget": {
    "total": 50000,
    "currency": "THB",
    "per_day": null
  },
  "preferences": {
    "style": "city_break",
    "daily_time_window": { "start": "10:00", "end": "20:00" },
    "constraints": {
      "max_walking_km_per_day": 5,
      "has_children": false,
      "has_seniors": false,
      "needs_rest_time": true,
      "avoid_crowds": false
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trip_id": "uuid",
    "status": "draft",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

#### GET /trips/{tripId}
Get trip details

#### PATCH /trips/{tripId}
Update trip preferences

#### DELETE /trips/{tripId}
Delete trip

### Itinerary Generation

#### POST /trips/{tripId}/generate
Generate itinerary automatically

**Request:**
```json
{
  "selected_pois": ["poi_id_1", "poi_id_2"],
  "optimize_budget": true,
  "regenerate_mode": "full" // or "incremental"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "itinerary_id": "uuid",
    "days": [
      {
        "day": 1,
        "date": "2024-03-01",
        "items": [
          {
            "item_id": "uuid",
            "type": "poi",
            "poi_id": "poi_id_1",
            "start_time": "10:00",
            "end_time": "12:00",
            "duration_minutes": 120,
            "is_pinned": false,
            "route_from_previous": {
              "mode": "walking",
              "duration_minutes": 15,
              "distance_km": 1.2,
              "cost_estimate": 0
            }
          }
        ],
        "total_cost_estimate": 1500,
        "total_travel_time_minutes": 45
      }
    ],
    "total_cost_estimate": 15000,
    "generated_at": "ISO8601"
  }
}
```

### Itinerary Editing

#### PATCH /trips/{tripId}/days/{dayId}/items/{itemId}
Edit itinerary item

**Request:**
```json
{
  "start_time": "11:00",
  "is_pinned": true,
  "notes": "Custom note"
}
```

#### POST /trips/{tripId}/days/{dayId}/items
Add new item to day

#### DELETE /trips/{tripId}/days/{dayId}/items/{itemId}
Remove item

#### POST /trips/{tripId}/days/{dayId}/items/reorder
Reorder items

**Request:**
```json
{
  "item_ids": ["id1", "id2", "id3"]
}
```

### POI Search

#### GET /pois/search
Search POIs

**Query Parameters:**
- `q`: search query
- `location`: lat,lng
- `radius_km`: number
- `tags`: comma-separated
- `budget_range`: min,max
- `open_now`: boolean
- `kid_friendly`: boolean

**Response:**
```json
{
  "success": true,
  "data": {
    "pois": [
      {
        "poi_id": "uuid",
        "name": "Grand Palace",
        "category": "attraction",
        "location": { "lat": 13.7500, "lng": 100.4925 },
        "hours": {
          "monday": { "open": "08:30", "close": "15:30" },
          "tuesday": { "open": "08:30", "close": "15:30" }
        },
        "price_range": { "min": 500, "max": 500, "currency": "THB" },
        "avg_duration_minutes": 120,
        "rating": 4.5,
        "tags": ["historical", "indoor", "popular"]
      }
    ],
    "total": 50,
    "page": 1,
    "per_page": 20
  }
}
```

### Booking

#### POST /trips/{tripId}/bookings
Create booking from itinerary item

**Request:**
```json
{
  "item_id": "uuid",
  "provider": "provider_name",
  "provider_option_id": "external_id",
  "traveler_details": {
    "adults": 2,
    "children": 0
  },
  "idempotency_key": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "status": "pending",
    "provider": "provider_name",
    "external_reference": "provider_ref",
    "price": {
      "amount": 2000,
      "currency": "THB"
    },
    "policies": {
      "cancellation": "free_until_24h",
      "refund": "full_refund"
    },
    "voucher_url": "https://...",
    "created_at": "ISO8601"
  }
}
```

#### GET /trips/{tripId}/bookings
List all bookings for trip

#### GET /trips/{tripId}/bookings/{bookingId}
Get booking details

#### POST /trips/{tripId}/bookings/{bookingId}/cancel
Cancel booking

### Events & Monitoring

#### GET /trips/{tripId}/events
Get event signals for trip

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "event_id": "uuid",
        "type": "weather",
        "severity": "high",
        "location": { "lat": 13.7563, "lng": 100.5018 },
        "time_slot": {
          "start": "2024-03-01T14:00:00Z",
          "end": "2024-03-01T18:00:00Z"
        },
        "details": {
          "condition": "heavy_rain",
          "impact": "outdoor_activities_affected"
        },
        "affected_items": ["item_id_1"],
        "detected_at": "ISO8601"
      }
    ]
  }
}
```

### Replanning

#### POST /trips/{tripId}/replan/propose
Generate replan proposals

**Request:**
```json
{
  "trigger_event_id": "uuid",
  "options_count": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "proposals": [
      {
        "proposal_id": "uuid",
        "score": 0.85,
        "explanation": "Replaces outdoor activities with indoor alternatives",
        "changes": {
          "replaced_items": [
            {
              "old_item_id": "uuid",
              "new_item": { ... }
            }
          ],
          "moved_items": [
            {
              "item_id": "uuid",
              "old_time": "14:00",
              "new_time": "16:00"
            }
          ]
        },
        "impact": {
          "cost_change": { "amount": -200, "currency": "THB" },
          "time_change_minutes": 30,
          "distance_change_km": -1.5
        }
      }
    ]
  }
}
```

#### POST /trips/{tripId}/replan/apply
Apply replan proposal

**Request:**
```json
{
  "proposal_id": "uuid",
  "idempotency_key": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "new_version_id": "uuid",
    "applied_at": "ISO8601",
    "rollback_available_until": "ISO8601"
  }
}
```

### Sharing & Collaboration

#### POST /trips/{tripId}/share
Create share link

**Request:**
```json
{
  "role": "viewer", // or "editor"
  "expires_at": "ISO8601" // optional
}
```

#### GET /trips/shared/{shareToken}
Access shared trip

#### POST /trips/{tripId}/collaborators
Add collaborator

#### POST /trips/{tripId}/votes
Vote on activity/replan option

#### POST /trips/{tripId}/comments
Add comment

### Execution Mode

#### GET /trips/{tripId}/today
Get today's itinerary view

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-03-01",
    "items": [
      {
        "item_id": "uuid",
        "name": "Grand Palace",
        "start_time": "10:00",
        "end_time": "12:00",
        "location": { "lat": 13.7500, "lng": 100.4925 },
        "navigation_url": "https://maps.google.com/...",
        "booking_status": "confirmed",
        "check_in_required": false
      }
    ],
    "weather": {
      "condition": "sunny",
      "temperature": 32
    }
  }
}
```

### Error Codes

- `AUTH_REQUIRED`: Authentication required
- `AUTH_INVALID`: Invalid token
- `TRIP_NOT_FOUND`: Trip not found
- `ITINERARY_INVALID`: Itinerary validation failed
- `BOOKING_FAILED`: Booking failed
- `PROVIDER_ERROR`: External provider error
- `REPLAN_FAILED`: Replan application failed
- `IDEMPOTENCY_CONFLICT`: Idempotency key conflict
- `VALIDATION_ERROR`: Request validation failed
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded

