# Setup Guide
## GoBuddy Development Environment

This guide will help you set up the GoBuddy development environment.

## Prerequisites

### Required Software

1. **Node.js 18+**
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **PostgreSQL 14+**
   - Download from [postgresql.org](https://www.postgresql.org/download/)
   - Verify: `psql --version`
   - Create database: `createdb gobuddy`

3. **Redis 6+**
   - Download from [redis.io](https://redis.io/download)
   - Verify: `redis-cli ping` (should return PONG)

4. **Git**
   - Download from [git-scm.com](https://git-scm.com/downloads)

## Installation Steps

### 1. Clone Repository
```bash
git clone <repository-url>
cd GoBuddy
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create `.env` file in the root directory:

```bash
# Copy example (if available)
cp .env.example .env
```

Required environment variables:
```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gobuddy
DB_USER=your_username
DB_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# OTP
OTP_EXPIRES_IN=300
OTP_LENGTH=6

# Email (for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# External APIs
GOOGLE_PLACES_API_KEY=your-google-places-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Logging
LOG_LEVEL=info
```

### 4. Database Setup

#### Create Database
```bash
createdb gobuddy
```

#### Run Migrations
```bash
psql -d gobuddy -f src/migrations/001_initial_schema.sql
```

Or using psql:
```bash
psql -d gobuddy
\i src/migrations/001_initial_schema.sql
```

### 5. Start Redis

**Linux/Mac:**
```bash
redis-server
```

**Windows:**
```bash
# If installed via WSL
wsl redis-server

# Or use Redis for Windows
redis-server.exe
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:latest
```

### 6. Build and Run

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

### 7. Verify Installation

1. **Health Check:**
   ```bash
   curl http://localhost:3000/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test Database Connection:**
   - Check server logs for "Database connected successfully"

3. **Test Redis Connection:**
   - Check server logs for "Redis Client Connected"

## Testing

### Run Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Development Workflow

### Code Quality

**Linting:**
```bash
npm run lint
npm run lint:fix
```

**Type Checking:**
```bash
npx tsc --noEmit
```

### Database Migrations

**Generate new migration:**
```bash
npm run migrate:generate
```

**Run migrations:**
```bash
npm run migrate
```

## Troubleshooting

### Database Connection Issues

1. **Check PostgreSQL is running:**
   ```bash
   pg_isready
   ```

2. **Verify credentials in .env**

3. **Check database exists:**
   ```bash
   psql -l | grep gobuddy
   ```

### Redis Connection Issues

1. **Check Redis is running:**
   ```bash
   redis-cli ping
   ```

2. **Check Redis URL in .env**

3. **Verify port 6379 is not blocked**

### Port Already in Use

If port 3000 is already in use:
1. Change `PORT` in `.env`
2. Or kill the process using port 3000:
   ```bash
   # Linux/Mac
   lsof -ti:3000 | xargs kill
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

### Module Not Found Errors

1. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check TypeScript paths in tsconfig.json**

## Next Steps

After setup is complete:
1. Review `docs/EPICS.md` for development tasks
2. Start with Epic 2: Itinerary Generator
3. Check `docs/API_CONTRACT.md` for API documentation

## Getting Help

- Check `docs/` directory for detailed documentation
- Review error logs in console
- Check database and Redis connection status

