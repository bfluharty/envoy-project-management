#!/bin/bash
set -e

# -------------------------------------------------
# Configuration
# -------------------------------------------------
PROJECT_SERVICE="project-management"
REASONING_SERVICE="reasoning-engine"
DB_SERVICE="postgres"

# ----------------------------
# Cleanup function
# ----------------------------
cleanup() {
  echo
  echo "Stopping containers..."
  docker compose down
  exit 0
}

# Trap Ctrl+C, termination signals, and script exit
trap cleanup SIGINT SIGTERM EXIT


# Wait for Postgres container to be ready
wait_for_postgres() {
  echo "Waiting for Postgres to be ready..."
  until docker compose exec -T $DB_SERVICE pg_isready -U "${DB_USER:-postgres}" > /dev/null 2>&1; do
    sleep 1
  done
  echo "Postgres is ready!"
}

# -------------------------------------------------
# 1) Start Postgres container
# -------------------------------------------------
echo "Starting Postgres..."
docker compose up -d $DB_SERVICE

# Wait for DB to be ready
wait_for_postgres

# -------------------------------------------------
# 2) Start reasoning-engine container
# -------------------------------------------------
echo "Starting reasoning engine..."
docker compose up -d $REASONING_SERVICE

# -------------------------------------------------
# 3) Run migrations
# -------------------------------------------------
echo "Running migrations..."
docker compose run --rm $PROJECT_SERVICE node ace migration:run

# -------------------------------------------------
# 4) Run seed only if database is empty
# -------------------------------------------------
echo "Seeding database..."
docker compose run --rm $PROJECT_SERVICE node ace db:seed

# -------------------------------------------------
# 5) Start API container (live reload)
# -------------------------------------------------
echo "Starting API container..."
docker compose up $PROJECT_SERVICE