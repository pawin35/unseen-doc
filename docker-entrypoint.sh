#!/bin/sh
set -e

# Apply migrations against the volume-mounted database, seed defaults
# (idempotent), then start the server.
npx prisma migrate deploy
npx tsx prisma/seed.ts
exec npx next start -p "${PORT:-3000}"
