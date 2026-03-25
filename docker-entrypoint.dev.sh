#!/bin/sh
set -e

LOCKFILE_HASH=$(md5sum /app/package-lock.json 2>/dev/null | cut -d' ' -f1)
STAMP_FILE="/app/node_modules/.install-stamp"

if [ ! -f "$STAMP_FILE" ] || [ "$(cat $STAMP_FILE 2>/dev/null)" != "$LOCKFILE_HASH" ]; then
  echo "Installing dependencies..."
  cd /app
  npm ci
  npm install --no-save @swc/core-linux-x64-musl@1.11.24

  # Remove knex's exports map entirely so internal paths remain accessible.
  # @adonisjs/lucid v21 imports several knex internals (e.g. lib/util/helpers.js,
  # lib/dialects/sqlite3) that are not covered by knex v3's non-recursive wildcards.
  node -e "
    const fs = require('fs');
    const p = '/app/node_modules/knex/package.json';
    const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
    delete pkg.exports;
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
  "

  echo "$LOCKFILE_HASH" > "$STAMP_FILE"
fi

exec "$@"
