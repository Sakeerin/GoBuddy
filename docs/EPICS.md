# Epics & User Stories
## GoBuddy - Development Epics Breakdown

This document contains the detailed epics and tickets that can be used with Cursor AI to implement the system.

## Epic 1: Foundation (Auth, Trip, POI base)

### T1.1 User auth (email OTP/OAuth) + profile prefs
**Prompt (Cursor):**
```
Implement auth module with email OTP + optional Google OAuth. Include user profile prefs (currency, language, distance unit). Add unit/integration tests.

Requirements:
- Email/OTP authentication
- Google OAuth integration (optional)
- User profile with preferences:
  - Language (default: en)
  - Currency (default: THB)
  - Distance unit (km/miles)
  - Dietary restrictions
  - Mobility constraints
  - Travel preferences (budget/comfort/adventure)
- Guest mode support (limited features)
- "Move trip to account" functionality
- Unit and integration tests
```

**Acceptance Criteria:**
- User can register/login with email OTP
- User can login with Google OAuth
- Guest can create trips but must login to book/save permanently
- Profile preferences are saved and used throughout system
- Language/currency changes update calculations and display correctly

### T1.2 Trip CRUD + preferences schema
**Prompt:**
```
Create Trip service with CRUD, trip preferences (dates, travelers, budget, style, constraints). Ensure validation and migrations.

Requirements:
- Trip CRUD operations
- Trip preferences schema:
  - Destination (city, country, coordinates)
  - Dates (start, end)
  - Travelers (adults, children, seniors)
  - Budget (total, per_day, currency)
  - Style (city_break, nature, theme, workation, family)
  - Daily time window (start, end)
  - Constraints:
    - Max walking km per day
    - Has children/seniors
    - Needs rest time
    - Avoid crowds
    - Risk areas to avoid
- Validation
- Database migrations
- Validation rules
```

**Acceptance Criteria:**
- Can create/read/update/delete trips
- Preferences are validated
- Changing parameters allows itinerary regeneration while preserving pinned items

### T1.3 POI search + details + tags
**Prompt:**
```
Implement POI service with search/filter endpoints, caching, and normalized POI model (hours, tags, avg_duration, price_range).

Requirements:
- POI search endpoint with filters:
  - Query text
  - Location (lat/lng, radius)
  - Tags
  - Budget range
  - Open now
  - Kid friendly
- POI details endpoint
- Normalized POI model:
  - place_id
  - Name, description
  - Location (geo coordinates)
  - Hours (opening/closing times by day)
  - Tags (categories, attributes)
  - Average duration (minutes)
  - Price range (min, max, currency)
  - Rating
- Caching layer
- Integration with external POI APIs (Google Places, etc.)
```

**Acceptance Criteria:**
- Can search POIs with various filters
- Selected POIs are used in itinerary with real times and distances
- POI details are accurate and up-to-date

**Acceptance (Epic 1):**
- Can create trips and save preferences
- Can search POIs and add them to trips

---

## Epic 2: Itinerary Generator v1 (Rule-based)

### T2.1 Itinerary generate endpoint + engine skeleton
**Prompt:**
```
Build itinerary generation engine v1: rule-based scheduler that places selected POIs into days respecting opening hours, travel time placeholder, daily time window, and constraints. Return itinerary items.

Requirements:
- Itinerary generation endpoint
- Rule-based scheduler algorithm:
  - Input: Selected POIs, trip preferences, constraints
  - Output: Day-by-day itinerary with items
  - Rules:
    - Respect POI opening hours
    - Respect daily time window
    - Include travel time between items (placeholder)
    - Include buffer time between activities
    - Respect max walking distance per day
    - Optimize for time efficiency
- Return structure:
  - Days array
  - Items per day with:
    - POI reference
    - Start/end times
    - Duration
    - Route from previous item
- Validation of generated itinerary
```

**Acceptance Criteria:**
- Generated itinerary respects all constraints
- Items are properly scheduled within opening hours
- Travel times are included (even if placeholder)

### T2.2 Itinerary editor (drag/reorder/pin) + validation
**Prompt:**
```
Implement itinerary edit operations: reorder items, pin/unpin, set start time, remove/add. Add validator to flag infeasible schedules and provide fix suggestions.

Requirements:
- Edit operations:
  - Reorder items (drag & drop)
  - Pin/unpin items (pinned items cannot be moved/replaced)
  - Set custom start time
  - Remove items
  - Add new items
- Itinerary validator:
  - Check time feasibility
  - Check opening hours compliance
  - Check distance feasibility
  - Check budget compliance
  - Flag infeasible schedules
  - Provide fix suggestions
- Auto-adjust times when items are moved
- Warn if activities cannot be completed/places are closed
```

**Acceptance Criteria:**
- Can reorder items and system adjusts times
- Can pin items and they are protected from replan
- Validator flags impossible schedules and suggests fixes
- Moving activities adjusts entire day schedule and warns if infeasible

### T2.3 Versioning (trip snapshots)
**Prompt:**
```
Add itinerary versioning with snapshots/diffs per change. Provide rollback to previous version.

Requirements:
- Versioning system:
  - Create snapshot on each significant change
  - Store diffs between versions
  - Version metadata (timestamp, user, change type)
- Rollback functionality:
  - List previous versions
  - View diff between versions
  - Rollback to previous version
- Version history API
```

**Acceptance Criteria:**
- Each change creates a version snapshot
- Can view version history and diffs
- Can rollback to previous version

**Acceptance (Epic 2):**
- Generate produces day-by-day itinerary
- Manual edits are validated and system warns about infeasibility

---

## Epic 3: Routing + Costing

### T3.1 RouteSegment compute + update modes
**Prompt:**
```
Implement routing service interface that computes distance/duration/cost_est between itinerary items for modes (walk/transit/taxi). Provide stub provider for MVP and allow provider swap.

Requirements:
- Routing service interface
- Compute route segments between items:
  - From item
  - To item
  - Mode (walking, transit, taxi)
  - Distance (km)
  - Duration (minutes)
  - Cost estimate
- Support multiple modes
- Stub provider for MVP (can use mock data)
- Provider abstraction for easy swap
- Cache route results
- Update routes when mode changes
```

**Acceptance Criteria:**
- Can compute routes between items
- Changing transportation mode updates cost and schedule
- Routes are cached for performance

### T3.2 Costing service (estimate) + breakdown
**Prompt:**
```
Create costing service that aggregates item costs + route costs + meal estimates into per-day and total breakdown. Support currency conversion abstraction.

Requirements:
- Costing service:
  - Aggregate costs from:
    - POI entry fees
    - Route costs
    - Meal estimates
    - Hotel costs (if booked)
    - Activity costs (if booked)
  - Per-day breakdown
  - Total breakdown
  - Cost categories:
    - Accommodation
    - Activities
    - Transportation
    - Meals
    - Other
- Currency conversion abstraction
- Price confidence levels (estimated vs fixed)
- Update costs when prices change
```

**Acceptance Criteria:**
- Itinerary includes travel time/cost estimates
- Budget summary shows per-day and total costs
- Costs are categorized correctly

**Acceptance (Epic 3):**
- Itinerary has travel time/cost estimates
- Budget summary per day/total is accurate

---

## Epic 4: Booking Orchestrator (Provider 1)

### T4.1 Booking state machine + idempotency
**Prompt:**
```
Implement booking orchestrator with state machine (pending/confirmed/failed/canceled/refunded) and idempotency keys. Store provider external IDs, policies, vouchers.

Requirements:
- Booking state machine:
  - States: pending, confirmed, failed, canceled, refunded
  - State transitions with validation
  - State history
- Idempotency:
  - Idempotency key per booking request
  - Prevent duplicate bookings
  - Return existing booking if key reused
- Booking model:
  - Provider reference
  - External booking ID
  - Status
  - Price (amount, currency)
  - Policies (cancellation, refund)
  - Voucher URL/blob
  - Booking reference number
  - Linked itinerary item
- Audit log for all state changes
```

**Acceptance Criteria:**
- Booking state machine works correctly
- Idempotency prevents duplicate bookings
- All booking data is stored correctly

### T4.2 Provider adapter (Activities OR Hotels - choose one)
**Prompt:**
```
Create provider adapter interface and implement ProviderX adapter for {activities/hotels}. Include error mapping, retries, and webhook ingestion stub.

Requirements:
- Provider adapter interface (see PROVIDERS.md)
- Implement adapter for chosen provider:
  - Activities: GetYourGuide, Klook, or Viator
  - Hotels: Booking.com, Agoda, or Expedia
- Error mapping to standard codes
- Retry logic with exponential backoff
- Webhook ingestion stub
- Health check
- Rate limiting handling
```

**Acceptance Criteria:**
- Can search items from provider
- Can create bookings through provider
- Errors are mapped correctly
- Retries work on transient failures

### T4.3 Booking UI flow + fallback suggestions
**Prompt:**
```
Implement booking UI flow from itinerary item: show options, confirm price, handle failure with alternative suggestions.

Requirements:
- Booking flow:
  - Select itinerary item to book
  - Show provider options
  - Show price and policies
  - Confirm booking
  - Handle booking creation
  - Show booking status
- Failure handling:
  - Detect booking failure
  - Suggest alternatives (similar price/time)
  - Allow retry or choose alternative
- Booking status updates
- Voucher display
```

**Acceptance Criteria:**
- Can book at least one category (activities or hotels)
- On failure, alternatives are suggested
- Booking status is tracked correctly

**Acceptance (Epic 4):**
- Can actually book at least one category (activities/hotels)
- On failure, alternatives are suggested

---

## Epic 5: Real-time Monitoring + Replan

### T5.1 Weather ingestion + rule triggers
**Prompt:**
```
Build event monitor for weather signals by location+time. Create rule engine that triggers replan when heavy rain overlaps outdoor items.

Requirements:
- Event monitor service:
  - Ingest weather data by location and time
  - Store event signals
  - Severity levels (low, medium, high)
- Rule engine:
  - Trigger rules based on event type and severity
  - Weather rules:
    - Heavy rain + outdoor activity → trigger replan
  - Event-to-item matching
  - Generate replan triggers
- Integration with weather APIs
- Queue for event processing
```

**Acceptance Criteria:**
- Weather events are detected and stored
- Rules trigger correctly when conditions met
- Replan triggers are generated

### T5.2 Replan proposal generator (1-3 options) + diff
**Prompt:**
```
Implement replan engine that generates 1-3 alternative plans minimizing disruption; respects pinned items; outputs diffs (moved/replaced/removed), impact summary (time/cost/distance).

Requirements:
- Replan proposal generator:
  - Input: Current itinerary, trigger event, constraints
  - Output: 1-3 alternative proposals
  - Algorithm:
    - Minimize disruption
    - Respect pinned items (cannot move/replace)
    - Find alternatives for affected items
    - Optimize for time/cost/distance
  - Proposal structure:
    - Score (quality metric)
    - Explanation
    - Changes (moved/replaced/removed items)
    - Impact summary:
      - Time change
      - Cost change
      - Distance change
  - Diff generation
```

**Acceptance Criteria:**
- Generates 1-3 proposals
- Proposals respect pinned items
- Diffs are clear and accurate
- Impact summaries are correct

### T5.3 Apply replan transactionally + rollback
**Prompt:**
```
Implement transactional apply of replan proposal with versioning and rollback on failure. Add tests for consistency.

Requirements:
- Apply replan:
  - Transactional operation
  - Atomic update of itinerary
  - Create version snapshot before apply
  - Update all affected items
  - Update routes and costs
  - No partial updates
- Rollback:
  - On failure, rollback to previous version
  - Rollback API endpoint
  - Time-limited rollback window
- Consistency checks:
  - Validate applied itinerary
  - Ensure no orphaned items
  - Ensure all times are valid
- Tests:
  - Test successful apply
  - Test rollback on failure
  - Test consistency
```

**Acceptance Criteria:**
- Apply is transactional and atomic
- No partial updates occur
- Rollback works correctly
- Applied itinerary is always consistent

**Acceptance (Epic 5):**
- Heavy rain during outdoor activity → proposal generated
- Apply works correctly and itinerary changes properly

---

## Epic 6: Share + Execution Mode

### T6.1 Share view-only link + permissions
**Prompt:**
```
Implement trip sharing with roles (owner/editor/viewer). Generate share links with access control and audit log.

Requirements:
- Sharing system:
  - Generate share links
  - Roles: owner, editor, viewer
  - Access control per role
  - Expiration dates (optional)
  - Revoke access
- Permissions:
  - Viewer: read-only
  - Editor: can edit itinerary
  - Owner: full control
- Audit log for share actions
- Share link format: /trips/shared/{token}
```

**Acceptance Criteria:**
- Can generate share links
- Permissions work correctly
- Access can be revoked
- Audit log tracks all actions

### T6.2 Today view + navigation links + offline read cache (basic)
**Prompt:**
```
Create Today view timeline with navigation links for each item and basic offline cache for itinerary and essential trip docs.

Requirements:
- Today view:
  - Timeline display
  - Current day's items
  - Navigation links (Google Maps, etc.)
  - Weather info
  - Booking status per item
  - Check-in requirements
- Offline cache:
  - Cache itinerary data
  - Cache essential trip documents
  - Cache map data (basic)
  - Sync when online
- Service worker or similar for offline support
```

**Acceptance Criteria:**
- Today view shows current day's timeline
- Navigation links work
- Offline mode allows reading itinerary
- Essential data is available offline

**Acceptance (Epic 6):**
- Can share trips with appropriate permissions
- Today view works and offline mode functions

---

## Epic 7: Admin + Observability

### T7.1 Admin console minimal (providers, logs)
**Prompt:**
```
Build admin console for managing providers, API keys, webhook logs, and booking troubleshooting tools.

Requirements:
- Admin console:
  - Provider management:
    - Add/edit/remove providers
    - Manage API keys (encrypted)
    - Configure webhooks
    - View provider health
  - Webhook logs:
    - View webhook events
    - Retry failed webhooks
    - Debug webhook issues
  - Booking troubleshooting:
    - View booking status
    - Resend vouchers
    - Manual override booking status
    - View booking history
- RBAC for admin access
- Audit log for admin actions
```

**Acceptance Criteria:**
- Can manage providers
- Can view and debug webhooks
- Can troubleshoot bookings
- Admin actions are audited

### T7.2 Observability baseline
**Prompt:**
```
Add structured logs, trace IDs for booking/replan, metrics dashboard endpoints, and alert hooks.

Requirements:
- Structured logging:
  - JSON format
  - Log levels
  - Context information
- Tracing:
  - Trace IDs for requests
  - Span tracking for operations
  - Correlation IDs
- Metrics:
  - Booking success rate
  - Provider latency
  - Replan triggers
  - API response times
  - Error rates
- Dashboard endpoints:
  - Health check
  - Metrics endpoint
  - System status
- Alert hooks:
  - Integration with alerting system
  - Threshold-based alerts
```

**Acceptance Criteria:**
- Structured logs are generated
- Trace IDs are included in all operations
- Metrics are collected and available
- Dashboard shows key metrics

**Acceptance (Epic 7):**
- Admin can manage system
- Observability is in place

---

## Definition of Done (DoD)

For each ticket:
- ✅ All endpoints have validation, standard error codes, and tests
- ✅ Booking/apply replan have idempotency + transaction + audit
- ✅ Itinerary validator must not allow "impossible plans" without warnings
- ✅ Monitoring has retry/backoff and doesn't spam notifications
- ✅ Code is reviewed and documented
- ✅ Tests pass (unit + integration)
- ✅ Documentation updated

