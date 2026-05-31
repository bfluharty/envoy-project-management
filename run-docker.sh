#!/bin/bash
set -e

# -------------------------------------------------
# Configuration
# -------------------------------------------------
PROJECT_SERVICE="project-management"
REASONING_SERVICE="reasoning-engine"
EMAIL_SERVICE="email-service"
DB_SERVICE="postgres"

# -------------------------------------------------
# Flags
# -------------------------------------------------
LOCAL=false

for arg in "$@"; do
  case $arg in
    --local) LOCAL=true ;;
  esac
done

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

if [ "$LOCAL" = true ]; then
  # -------------------------------------------------
  # LOCAL MODE: only Postgres + reasoning-engine + email-service in
  # Docker; run the Node app natively for fast I/O.
  # -------------------------------------------------

  # -------------------------------------------------
  # 1) Start Postgres + reasoning-engine + email-service containers
  # -------------------------------------------------
  echo "Starting Postgres, reasoning engine, and email service..."
  docker compose up -d $DB_SERVICE $REASONING_SERVICE $EMAIL_SERVICE

  wait_for_postgres

  # -------------------------------------------------
  # 2) Run migrations locally
  # -------------------------------------------------
  echo "Running migrations..."
  DB_HOST=localhost node ace migration:run

  # -------------------------------------------------
  # 2) Run database seeders locally
  # -------------------------------------------------
  echo "Seeding database..."
  DB_HOST=localhost node ace db:seed

  # -------------------------------------------------
  # 3) Start dev server locally
  # -------------------------------------------------
  echo "Starting dev server locally..."
  DB_HOST=localhost npm run dev

else
  # -------------------------------------------------
  # DOCKER MODE (default)
  # -------------------------------------------------

  # -------------------------------------------------
  # 0) Build images and reset node_modules volume
  # -------------------------------------------------
  echo "Building images..."
  docker compose build

  echo "Resetting node_modules volume..."
  docker volume rm -f envoy-project-management_project_management_node_modules 2>/dev/null || true

  # -------------------------------------------------
  # 1) Start Postgres container
  # -------------------------------------------------
  echo "Starting Postgres..."
  docker compose up -d $DB_SERVICE

  # Wait for DB to be ready
  wait_for_postgres

  # -------------------------------------------------
  # 2) Start reasoning-engine and email-service containers (live reload)
  # -------------------------------------------------
  echo "Starting reasoning engine and email service..."
  docker compose up -d $REASONING_SERVICE $EMAIL_SERVICE

  # -------------------------------------------------
  # 3) Run migrations
  # -------------------------------------------------
  echo "Running migrations..."
  docker compose run --rm $PROJECT_SERVICE node ace migration:run

  # -------------------------------------------------
  # 4) Run database seeders
  # -------------------------------------------------
  echo "Seeding database..."
  docker compose run --rm $PROJECT_SERVICE node ace db:seed

  # -------------------------------------------------
  # 5) Start project-management container (live reload)
  # -------------------------------------------------
  echo "Starting project management..."
  docker compose up $PROJECT_SERVICE

fi
