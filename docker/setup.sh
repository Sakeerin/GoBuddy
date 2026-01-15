#!/bin/bash
set -e

echo "=========================================="
echo "GoBuddy Docker Setup Script"
echo "=========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Copy .env.example to .env if .env doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo ".env file created. Please update it with your configuration."
else
    echo ".env file already exists."
fi

# Make init script executable
chmod +x docker/init-db.sh

# Copy seed.sql to docker directory
if [ ! -f docker/seed.sql ]; then
    echo "Copying seed.sql to docker directory..."
    cp docker/seed.sql docker/seed.sql.bak 2>/dev/null || true
fi

# Start Docker containers
echo ""
echo "Starting Docker containers..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo ""
echo "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U gobuddy_user -d gobuddy > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

echo "PostgreSQL is ready!"

# Wait for Redis to be ready
echo ""
echo "Waiting for Redis to be ready..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo "Waiting for Redis..."
    sleep 2
done

echo "Redis is ready!"

# Run migrations
echo ""
echo "Running database migrations..."
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/001_initial_schema.sql || true
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/002_itinerary_schema.sql || true
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/003_versioning_schema.sql || true
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/004_booking_schema.sql || true
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/005_events_schema.sql || true
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/006_replan_schema.sql || true
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/007_sharing_schema.sql || true
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/migrations/008_admin_schema.sql || true

# Load seed data
echo ""
echo "Loading demo data..."
docker-compose exec -T postgres psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/seed.sql || true

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Services:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - Application: localhost:3000 (if running in Docker)"
echo ""
echo "Database credentials:"
echo "  - Database: gobuddy"
echo "  - User: gobuddy_user"
echo "  - Password: gobuddy_password"
echo ""
echo "To start the application:"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "To stop Docker containers:"
echo "  docker-compose down"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
