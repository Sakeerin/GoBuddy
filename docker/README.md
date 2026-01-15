# Docker Setup for GoBuddy

This directory contains Docker configuration files for running GoBuddy with PostgreSQL and Redis.

## Quick Start

1. **Run the setup script:**
   ```bash
   chmod +x docker/setup.sh
   ./docker/setup.sh
   ```

2. **Or manually:**
   ```bash
   # Copy environment file
   cp .env.example .env
   
   # Start containers
   docker-compose up -d
   
   # Wait for services to be ready, then load seed data
   docker-compose exec postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/seed.sql
   ```

## Services

- **PostgreSQL**: Port 5432
- **Redis**: Port 6379
- **Application**: Port 3000 (optional, can run locally)

## Database Credentials

- **Database**: gobuddy
- **User**: gobuddy_user
- **Password**: gobuddy_password

## Demo Data

The seed script (`seed.sql`) creates:

- **3 Demo Users**:
  - `demo@example.com` - Regular user
  - `admin@example.com` - Admin user
  - `traveler@example.com` - Traveler user

- **2 Demo Trips**:
  - Bangkok Adventure (with itinerary)
  - Tokyo Family Trip

- **7 Sample POIs**:
  - Bangkok: Grand Palace, Wat Pho, Chatuchak Market, Mahanakhon Skywalk
  - Tokyo: Senso-ji Temple, Shibuya Crossing, Ueno Park

- **1 Sample Booking**: Confirmed booking for Grand Palace

- **1 Provider Config**: Stub activity provider

## Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f
```

### Access PostgreSQL
```bash
docker-compose exec postgres psql -U gobuddy_user -d gobuddy
```

### Access Redis
```bash
docker-compose exec redis redis-cli
```

### Reset database (WARNING: Deletes all data)
```bash
docker-compose down -v
docker-compose up -d
```

### Reload seed data
```bash
docker-compose exec postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/seed.sql
```

## Running Application Locally

You can run the application locally while using Docker for databases:

1. Start Docker services:
   ```bash
   docker-compose up -d postgres redis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set environment variables in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=gobuddy
   DB_USER=gobuddy_user
   DB_PASSWORD=gobuddy_password
   REDIS_URL=redis://localhost:6379
   ```

4. Run the application:
   ```bash
   npm run dev
   ```

## Troubleshooting

### Port already in use
If ports 5432 or 6379 are already in use, modify `docker-compose.yml` to use different ports.

### Database connection errors
Make sure PostgreSQL container is healthy:
```bash
docker-compose ps
```

### Reset everything
```bash
docker-compose down -v
rm -rf postgres_data redis_data
./docker/setup.sh
```
