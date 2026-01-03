# GoBuddy
## Intelligent Travel Planning System

GoBuddy is an intelligent travel planning system that helps users create trip plans quickly (in minutes) with budget management, complete booking capabilities (flights/cars/hotels/activities) through partners, and real-time plan adjustments during trips based on actual events (rain, sold-out tickets, delays, closures) with alternatives and time/budget impact analysis.

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

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm or yarn

### Setup Instructions

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

**Next Steps:**
- Epic 2: Itinerary Generator v1
- Epic 3: Routing + Costing

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
