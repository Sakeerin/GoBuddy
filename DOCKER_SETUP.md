# Docker Setup Guide
## GoBuddy - Quick Start with Docker

This guide will help you set up GoBuddy with Docker for development and demo purposes.

## Prerequisites

- Docker Desktop (or Docker + Docker Compose)
- Node.js 18+ (for running the application locally)
- npm or yarn

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
npm run docker:setup
# or
chmod +x docker/setup.sh && ./docker/setup.sh
```

This will:
1. Create `.env` file from `.env.example`
2. Start PostgreSQL and Redis containers
3. Run all database migrations
4. Load demo data

### Option 2: Manual Setup

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start Docker services
docker-compose up -d postgres redis

# 3. Wait for services to be ready (about 10 seconds)
sleep 10

# 4. Run migrations (if needed)
# Migrations run automatically on first start

# 5. Load demo data
docker-compose exec postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/seed.sql

# Or use npm script
npm run seed
```

## Services

| Service | Port | Description |
|--------|------|-------------|
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Cache and session store |
| Application | 3000 | GoBuddy API (optional, can run locally) |

## Database Credentials

```
Database: gobuddy
User: gobuddy_user
Password: gobuddy_password
```

## Running the Application

### Option 1: Run Locally (Recommended for Development)

```bash
# Install dependencies
npm install

# Start application
npm run dev
```

The app will connect to Docker containers for database and Redis.

### Option 2: Run in Docker

```bash
# Start all services including app
docker-compose up
```

## Demo Data

The seed script creates:

### Users
- **demo@example.com** - Regular user
- **admin@example.com** - Super admin (use for admin console)
- **traveler@example.com** - Traveler user

**Note**: Passwords are hashed. Use OTP login for demo:
1. Request OTP: `POST /auth/otp/send` with email
2. Check logs for OTP code (in development)
3. Verify OTP: `POST /auth/otp/verify`

### Trips
- **Bangkok Adventure** (Trip ID: `10000000-0000-0000-0000-000000000001`)
  - 4-day trip to Bangkok
  - Includes itinerary with Grand Palace and Wat Pho
  - Has a confirmed booking

- **Tokyo Family Trip** (Trip ID: `10000000-0000-0000-0000-000000000002`)
  - 7-day family trip to Tokyo
  - Includes child-friendly POIs

### POIs
- **Bangkok**: Grand Palace, Wat Pho, Chatuchak Market, Mahanakhon Skywalk
- **Tokyo**: Senso-ji Temple, Shibuya Crossing, Ueno Park

### Other Data
- 1 confirmed booking
- 1 provider configuration (stub-activity)
- 1 share link (viewer access)

## Useful Commands

### Docker Commands

```bash
# Start services
npm run docker:up
# or
docker-compose up -d

# Stop services
npm run docker:down
# or
docker-compose down

# View logs
npm run docker:logs
# or
docker-compose logs -f

# View specific service logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Database Commands

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U gobuddy_user -d gobuddy

# Run SQL file
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /path/to/file.sql

# Reload seed data
npm run seed
# or
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/seed.sql
```

### Redis Commands

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Check Redis connection
docker-compose exec redis redis-cli ping
```

## Testing the Setup

### 1. Check Services

```bash
# Check if containers are running
docker-compose ps

# Should show:
# - gobuddy-postgres (healthy)
# - gobuddy-redis (healthy)
```

### 2. Test Database Connection

```bash
# Connect to database
docker-compose exec postgres psql -U gobuddy_user -d gobuddy -c "SELECT COUNT(*) FROM users;"

# Should return: 3 (demo users)
```

### 3. Test API

```bash
# Start application
npm run dev

# Test health endpoint
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 4. Test Authentication

```bash
# Request OTP
curl -X POST http://localhost:3000/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@example.com"}'

# Check application logs for OTP code
# Then verify OTP
curl -X POST http://localhost:3000/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@example.com", "otp": "123456"}'
```

## Troubleshooting

### Port Already in Use

If ports 5432 or 6379 are already in use:

1. **Option 1**: Stop existing services using those ports
2. **Option 2**: Modify `docker-compose.yml` to use different ports:

```yaml
ports:
  - "5433:5432"  # Use 5433 instead of 5432
  - "6380:6379"  # Use 6380 instead of 6379
```

Then update `.env`:
```env
DB_PORT=5433
REDIS_URL=redis://localhost:6380
```

### Database Connection Errors

1. Check if PostgreSQL is healthy:
   ```bash
   docker-compose ps
   ```

2. Check PostgreSQL logs:
   ```bash
   docker-compose logs postgres
   ```

3. Restart services:
   ```bash
   docker-compose restart postgres
   ```

### Reset Everything

```bash
# Stop and remove containers and volumes
docker-compose down -v

# Remove data volumes (WARNING: Deletes all data)
docker volume rm gobuddy_postgres_data gobuddy_redis_data

# Run setup again
npm run docker:setup
```

### Migration Errors

If migrations fail:

```bash
# Check migration files exist
ls src/migrations/

# Manually run migrations
docker-compose exec postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/001_initial_schema.sql
# ... repeat for all migrations
```

### Seed Data Not Loading

```bash
# Check if seed.sql exists
ls docker/seed.sql

# Manually load seed data
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/seed.sql

# Or use npm script
npm run seed
```

## Environment Variables

Update `.env` file with your configuration:

```env
# Database (matches Docker Compose)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gobuddy
DB_USER=gobuddy_user
DB_PASSWORD=gobuddy_password

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=demo-jwt-secret-change-in-production
JWT_EXPIRES_IN=7d

# Email (optional for demo)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@gobuddy.com
```

## Production Considerations

For production deployment:

1. **Change default passwords** in `docker-compose.yml`
2. **Use strong JWT secret** in `.env`
3. **Enable SSL/TLS** for database connections
4. **Use secrets management** (Docker secrets, AWS Secrets Manager, etc.)
5. **Set up backups** for PostgreSQL
6. **Configure Redis persistence** properly
7. **Use environment-specific configurations**
8. **Set up monitoring and logging**

## Next Steps

1. ✅ Docker services running
2. ✅ Database seeded with demo data
3. ✅ Application running
4. 📖 Read [API_CONTRACT.md](docs/API_CONTRACT.md) for API documentation
5. 🧪 Test the API endpoints
6. 🎨 Build your frontend application

## Support

For issues or questions:
- Check [README.md](README.md) for general information
- Check [SETUP.md](SETUP.md) for detailed setup instructions
- Review Docker logs: `docker-compose logs`
