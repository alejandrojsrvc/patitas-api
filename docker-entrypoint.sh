#!/bin/sh

set -eu

echo "Applying pending database migrations..."
pnpm exec prisma migrate deploy

echo "Starting Patitas API..."
exec "$@"
