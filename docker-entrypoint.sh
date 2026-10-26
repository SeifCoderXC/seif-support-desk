#!/bin/sh
set -eu

attempt=1
until npx prisma migrate deploy; do
  if [ "$attempt" -ge 10 ]; then
    echo "Database migration failed" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "${1:-}" = "seed" ]; then
  exec npx tsx prisma/seed.ts
fi

exec node dist/index.js
