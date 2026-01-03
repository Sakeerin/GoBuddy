# Architecture Document
## GoBuddy - System Architecture & Module Design

### Core Services (แนะนำแยกเป็นโมดูลชัด)

#### 1. POI Service
- **Responsibilities**: search/filter, details, hours, tags
- **Dependencies**: External POI APIs (Google Places, Foursquare, etc.)
- **Data**: POI cache, curated lists

#### 2. Itinerary Service
- **Responsibilities**: generate, edit, validate, versioning
- **Dependencies**: POI Service, Routing Service, Costing Service
- **Data**: Itinerary items, day plans, versions

#### 3. Routing Service
- **Responsibilities**: compute segments, update on mode changes
- **Dependencies**: External routing APIs (Google Maps, OSRM, etc.)
- **Data**: Route segments, travel time cache

#### 4. Costing Service
- **Responsibilities**: estimate + actual from booking
- **Dependencies**: Itinerary Service, Booking Service
- **Data**: Cost breakdowns, price history

#### 5. Booking Orchestrator
- **Responsibilities**: provider adapters + state machine
- **Dependencies**: Provider adapters, Payment gateway
- **Data**: Bookings, vouchers, policies

#### 6. Event Monitor
- **Responsibilities**: ingest signals + trigger rules
- **Dependencies**: Weather APIs, POI status APIs, Transport APIs
- **Data**: Event signals, severity levels

#### 7. Replan Engine
- **Responsibilities**: propose + apply (transactional)
- **Dependencies**: Itinerary Service, Event Monitor, POI Service
- **Data**: Replan proposals, diffs, versions

#### 8. Collaboration Service
- **Responsibilities**: sharing, permissions, votes, comments
- **Dependencies**: Trip Service, User Service
- **Data**: Shares, permissions, votes, comments

#### 9. Notification Service
- **Responsibilities**: email/push/in-app notifications
- **Dependencies**: Email service, Push notification service
- **Data**: Notification queue, preferences

#### 10. Admin Service
- **Responsibilities**: content management, provider management, support tools
- **Dependencies**: All services (read-only + override capabilities)
- **Data**: Admin logs, overrides

### Data Flow

```
User Request
    ↓
API Gateway / Router
    ↓
Authentication Middleware
    ↓
Service Layer (Itinerary/Booking/etc.)
    ↓
Business Logic + Validation
    ↓
Data Access Layer
    ↓
Database / External APIs
```

### Key Data Flows

#### Itinerary Generation Flow
1. User creates trip with preferences
2. POI Service searches and filters POIs
3. Itinerary Service generates day-by-day plan
4. Routing Service computes travel times
5. Costing Service estimates budget
6. Return complete itinerary

#### Booking Flow
1. User selects itinerary item to book
2. Booking Orchestrator queries providers
3. User confirms booking
4. State machine: pending → confirmed/failed
5. Store voucher and policies
6. Update itinerary with booking details

#### Replan Flow
1. Event Monitor detects issue (weather/closure/etc.)
2. Replan Engine generates proposals
3. User reviews and selects option
4. Transactional apply to itinerary
5. Version snapshot created
6. Notifications sent

### Technology Stack Recommendations

**Backend:**
- Language: TypeScript/Node.js หรือ Python/FastAPI
- Framework: Express/NestJS หรือ FastAPI
- Database: PostgreSQL (primary), Redis (cache)
- Queue: Bull/BullMQ หรือ Celery

**External Integrations:**
- POI: Google Places API, Foursquare
- Routing: Google Maps Directions, OSRM
- Weather: OpenWeatherMap, WeatherAPI
- Booking: Provider-specific APIs (OTA, Activity platforms)

**Infrastructure:**
- Container: Docker
- Orchestration: Docker Compose (dev), Kubernetes (prod)
- Monitoring: Prometheus + Grafana
- Logging: ELK Stack หรือ Loki

