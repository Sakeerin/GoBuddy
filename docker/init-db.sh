#!/bin/bash
set -e

echo "Initializing GoBuddy database..."

# Wait for PostgreSQL to be ready
until pg_isready -U gobuddy_user -d gobuddy; do
  echo "Waiting for PostgreSQL..."
  sleep 1
done

echo "PostgreSQL is ready!"

# Run migrations in order
echo "Running migrations..."

for migration in /docker-entrypoint-initdb.d/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "Running migration: $(basename $migration)"
    psql -U gobuddy_user -d gobuddy -f "$migration"
  fi
done

echo "Migrations completed!"

# Run seed script if exists
if [ -f "/docker-entrypoint-initdb.d/seed.sql" ]; then
  echo "Running seed data..."
  psql -U gobuddy_user -d gobuddy -f /docker-entrypoint-initdb.d/seed.sql
  echo "Seed data loaded!"
fi

echo "Database initialization complete!"
