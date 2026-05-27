#!/bin/sh
set -e

LOCKFILE_HASH=$(md5sum /app/package-lock.json 2>/dev/null | cut -d' ' -f1)
STAMP_FILE="/app/node_modules/.install-stamp"

if [ ! -f "$STAMP_FILE" ] || [ "$(cat $STAMP_FILE 2>/dev/null)" != "$LOCKFILE_HASH" ]; then
  echo "Installing dependencies..."
  cd /app
  npm ci

  echo "$LOCKFILE_HASH" > "$STAMP_FILE"
fi

exec "$@"
