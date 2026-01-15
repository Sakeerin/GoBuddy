# GoBuddy
## Intelligent Travel Planning System

GoBuddy is an intelligent travel planning system that helps users create trip plans quickly (in minutes) with budget management, complete booking capabilities (flights/cars/hotels/activities) through partners, and real-time plan adjustments during trips based on actual events (rain, sold-out tickets, delays, closures) with alternatives and time/budget impact analysis.

> 🚀 **Quick Start**: See [QUICK_START.md](QUICK_START.md) to get started in 5 minutes!  
> 🐳 **Docker Setup**: See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed Docker instructions.

## Project Structure

```
GoBuddy/
├── docs/                    # Documentation
│   ├── PRD.md              # Product Requirements Document
│   ├── SRS.md              # Software Requirements Specification
│   ├── ARCH.md             # Architecture Document
│   ├── API_CONTRACT.md     # API Endpoints & Schemas
│   ├── RULES.md            # Business Rules & Constraints
│   ├── PROVIDERS.md        # Provider Integration Guide
│   └── EPICS.md            # Epics & User Stories
├── src/                    # Source code
│   ├── config/             # Configuration (DB, Redis)
│   ├── middleware/         # Express middleware
│   ├── migrations/         # Database migrations
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   │   ├── auth/          # Authentication services
│   │   ├── trip/          # Trip services
│   │   └── poi/           # POI services
│   ├── types/             # TypeScript types
│   ├── utils/            # Utilities
│   └── index.ts          # Application entry point
├── tests/                 # Tests (to be created)
├── package.json
├── tsconfig.json
└── README.md
```

## Key Features

### Core Capabilities
- **Fast Trip Planning**: Create complete trip plans in minutes
- **Auto Itinerary Generation**: AI-powered day-by-day itinerary with routes, timing, and cost estimates
- **Complete Booking**: Book hotels, activities, and (future) flights in one system
- **Real-time Monitoring**: Weather, closures, sold-out tickets, delays
- **Intelligent Re-planning**: Automatic plan adjustments with impact analysis
- **Travel Documents**: Schedules, map views, checklists, sharing

### User Groups
- **Travelers**: Solo/couples/families/friend groups
- **Trip Organizers**: Team/group trip planners
- **Admin/Support**: Content/partner management and support

## Key KPIs

- Time-to-plan (first plan creation) < 10 minutes
- Plan-to-book conversion %
- Replan success rate %
- NPS/CSAT post-trip
- Booking failure rate / Refund handling time

## MVP Scope (6-8 weeks)

### Must-Have Features
- Trip setup + POI search
- Auto itinerary (rule-based) + manual edit
- Route + travel time calculation
- Budget estimation
- Booking: Start with either "activities" or "hotels" first
- Weather-triggered replan (heavy rain → indoor options)
- Share view-only

### v1.1 Features
- Add another provider type
- Offline read capability
- Collaboration edit + votes

## Development Epics

1. **Foundation**: Auth, Trip, POI base ✅
2. **Itinerary Generator v1**: Rule-based scheduler
3. **Routing + Costing**: Travel time and budget calculation
4. **Booking Orchestrator**: Provider integration
5. **Real-time Monitoring + Replan**: Event-driven adjustments
6. **Share + Execution Mode**: Collaboration and travel mode
7. **Admin + Observability**: Management and monitoring

## Getting Started

### Quick Start with Docker (Recommended)

The easiest way to get started is using Docker:

```bash
# 1. Clone the repository
git clone <repository-url>
cd GoBuddy

# 2. Run automated setup
npm run docker:setup

# 3. Install dependencies
npm install

# 4. Start the application
npm run dev
```

For detailed Docker setup instructions, see [DOCKER_SETUP.md](DOCKER_SETUP.md).

### Manual Setup

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm or yarn

#### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd GoBuddy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb gobuddy

   # Run migrations
   psql -d gobuddy -f src/migrations/001_initial_schema.sql
   ```

5. **Start Redis** (if not running)
   ```bash
   redis-server
   ```

6. **Build the project**
   ```bash
   npm run build
   ```

7. **Run the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

8. **Run tests**
   ```bash
   npm test
   ```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/otp/send` - Send OTP to email
- `POST /auth/otp/verify` - Verify OTP and login
- `GET /auth/google` - Get Google OAuth URL
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/me` - Get current user profile
- `PATCH /auth/profile` - Update user profile
- `POST /auth/guest/session` - Create guest session
- `POST /auth/guest/move-trips` - Move trips to account

### Trips
- `POST /trips` - Create new trip
- `GET /trips` - List trips
- `GET /trips/:id` - Get trip details
- `PATCH /trips/:id` - Update trip
- `DELETE /trips/:id` - Delete trip
- `PATCH /trips/:id/status` - Update trip status

### Itinerary
- `POST /trips/:tripId/generate` - Generate itinerary
- `GET /trips/:tripId/itinerary` - Get itinerary
- `POST /trips/:tripId/days/:day/items/reorder` - Reorder items
- `PATCH /trips/:tripId/items/:itemId/pin` - Pin/unpin item
- `PATCH /trips/:tripId/items/:itemId/start-time` - Set start time
- `DELETE /trips/:tripId/items/:itemId` - Remove item
- `POST /trips/:tripId/days/:day/items` - Add item
- `GET /trips/:tripId/itinerary/validate` - Validate itinerary
- `GET /trips/:tripId/versions` - Get version history
- `GET /trips/:tripId/versions/:version` - Get specific version
- `GET /trips/:tripId/versions/:version1/compare/:version2` - Compare versions
- `POST /trips/:tripId/versions/:version/rollback` - Rollback to version

### Routing
- `POST /routing/compute` - Compute route between two points
- `PATCH /trips/:tripId/items/:itemId/route` - Update route mode for item
- `POST /trips/:tripId/routes/update-all` - Update all routes in itinerary
- `GET /routing/providers` - Get available routing providers

### Costing
- `GET /trips/:tripId/cost-breakdown` - Get cost breakdown for itinerary
- `POST /costing/convert-currency` - Convert currency amount
- `PATCH /trips/:tripId/items/:itemId/cost` - Update item cost

### Booking
- `POST /trips/:tripId/bookings` - Create booking
- `GET /trips/:tripId/bookings` - List bookings for trip
- `GET /trips/:tripId/bookings/:bookingId` - Get booking details
- `GET /trips/:tripId/bookings/:bookingId/history` - Get booking state history
- `POST /trips/:tripId/bookings/:bookingId/retry` - Retry failed booking
- `POST /trips/:tripId/bookings/:bookingId/cancel` - Cancel booking
- `GET /trips/:tripId/bookings/:bookingId/alternatives` - Get alternative options
- `GET /providers/:providerId/search` - Search items from provider
- `GET /providers/:providerId/items/:itemId` - Get item details
- `GET /providers/:providerId/items/:itemId/availability` - Check availability
- `POST /webhooks/providers/:providerId` - Handle provider webhook

### Events & Replanning
- `POST /trips/:tripId/events/weather` - Ingest weather event
- `GET /trips/:tripId/events` - Get event signals
- `GET /trips/:tripId/replan/triggers` - Get pending replan triggers
- `POST /trips/:tripId/replan/propose` - Generate replan proposals
- `GET /trips/:tripId/replan/proposals/:proposalId` - Get proposal details
- `POST /trips/:tripId/replan/apply` - Apply replan proposal
- `POST /trips/:tripId/replan/rollback` - Rollback replan

### Sharing & Collaboration
- `POST /trips/:tripId/shares` - Create share link
- `GET /trips/:tripId/shares` - List shares for trip
- `DELETE /trips/:tripId/shares/:shareToken` - Revoke share
- `GET /trips/shared/:shareToken` - Access shared trip
- `GET /trips/:tripId/shares/audit` - Get share audit log

### Execution Mode
- `GET /trips/:tripId/today` - Get today's view
- `GET /trips/:tripId/offline-cache` - Get offline cache

### Admin
- `POST /admin/users/:userId/make-admin` - Create admin user
- `GET /admin/providers` - List providers
- `POST /admin/providers` - Create provider
- `GET /admin/providers/:providerId` - Get provider details
- `PATCH /admin/providers/:providerId` - Update provider
- `DELETE /admin/providers/:providerId` - Delete provider
- `GET /admin/providers/:providerId/health` - Check provider health
- `GET /admin/webhooks` - List webhook logs
- `POST /admin/webhooks/:logId/retry` - Retry failed webhook
- `GET /admin/bookings/:bookingId/troubleshoot` - Get booking troubleshooting info
- `POST /admin/bookings/:bookingId/resend-voucher` - Resend voucher
- `POST /admin/bookings/:bookingId/override-status` - Override booking status
- `GET /admin/bookings/statistics` - Get booking statistics
- `GET /admin/audit-log` - Get admin audit log
- `GET /admin/metrics` - Get system metrics

### POIs
- `GET /pois/search` - Search POIs with filters
- `GET /pois/:id` - Get POI details

## Technology Stack

- **Backend**: TypeScript/Node.js with Express
- **Database**: PostgreSQL
- **Cache**: Redis
- **Authentication**: JWT, OAuth (Google)
- **Validation**: Zod
- **Logging**: Winston

## Environment Variables

See `.env.example` for required environment variables:
- Database configuration
- Redis configuration
- JWT secret
- OAuth credentials
- External API keys

## Database Schema

The initial schema includes:
- `users` - User accounts
- `user_profiles` - User preferences
- `guest_sessions` - Guest session management
- `otp_codes` - OTP verification codes
- `trips` - Trip records
- `trip_preferences` - Trip configuration
- `pois` - Points of Interest

See `src/migrations/001_initial_schema.sql` for full schema.

## Development

### Code Style
- TypeScript strict mode
- ESLint for linting
- Prettier (recommended)

### Testing
- Jest for unit and integration tests
- Supertest for API testing

### Project Status

**Epic 1: Foundation** ✅ Completed
- T1.1: User auth (email OTP/OAuth) + profile prefs
- T1.2: Trip CRUD + preferences schema
- T1.3: POI search + details + tags

**Epic 2: Itinerary Generator v1** ✅ Completed
- T2.1: Itinerary generate endpoint + engine skeleton
- T2.2: Itinerary editor (drag/reorder/pin) + validation
- T2.3: Versioning (trip snapshots)

**Epic 3: Routing + Costing** ✅ Completed
- T3.1: RouteSegment compute + update modes
- T3.2: Costing service (estimate) + breakdown

**Epic 4: Booking Orchestrator (Provider 1)** ✅ Completed
- T4.1: Booking state machine + idempotency
- T4.2: Provider adapter (Activities - Stub provider)
- T4.3: Booking UI flow + fallback suggestions

**Epic 5: Real-time Monitoring + Replan** ✅ Completed
- T5.1: Weather ingestion + rule triggers
- T5.2: Replan proposal generator (1-3 options) + diff
- T5.3: Apply replan transactionally + rollback

**Epic 6: Share + Execution Mode** ✅ Completed
- T6.1: Share view-only link + permissions
- T6.2: Today view + navigation links + offline read cache

**Epic 7: Admin + Observability** ✅ Completed
- T7.1: Admin console minimal (providers, logs)
- T7.2: Observability baseline

**All Core Epics Completed!** 🎉

## Documentation

See the `docs/` directory for detailed specifications:
- **PRD.md**: Product goals, scope, user groups
- **SRS.md**: Functional and non-functional requirements
- **ARCH.md**: System architecture and module design
- **API_CONTRACT.md**: API endpoints and request/response schemas
- **RULES.md**: Business rules and constraints
- **PROVIDERS.md**: Provider adapter interface and integration guide
- **EPICS.md**: Epics and user stories with implementation prompts

## License

(To be determined)

## Contributing

(To be added)
