#!/bin/sh
set -e

echo "Running database migrations..."

until node ace migration:run --force; do
  echo "Database not ready yet - retrying in 5 seconds..."
  sleep 5
done

echo "Starting AdonisJS server..."

exec node bin/server.js