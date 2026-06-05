#!/bin/bash
set -e

echo "========================================"
echo "  NexGen EMS — Team Setup Script"
echo "========================================"

# 1. Check prerequisites
for cmd in docker node npm; do
  if ! command -v $cmd &> /dev/null; then
    echo "ERROR: $cmd is required but not installed."
    exit 1
  fi
done

# 2. Create .env if not exists
if [ ! -f "apps/api/.env" ]; then
  echo "Creating apps/api/.env from .env.example..."
  cp .env.example apps/api/.env
  echo "⚠  Please edit apps/api/.env and fill in your credentials before continuing."
  echo "   Minimum required: DATABASE_URL, DIRECT_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY"
  read -p "Press ENTER after editing .env to continue..." _
fi

# 3. Install dependencies
echo ""
echo "Installing npm dependencies..."
npm ci

# 4. Generate Prisma client
echo ""
echo "Generating Prisma client..."
npx prisma generate --schema=packages/db/prisma/schema.prisma

# 5. Start Docker services (dev mode)
echo ""
echo "Starting Docker containers..."
docker compose -f docker-compose.dev.yml up --build -d

# 6. Wait for API health
echo ""
echo "Waiting for API to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "✓ API is healthy"
    break
  fi
  echo "  Waiting... ($i/30)"
  sleep 3
done

# 7. Run database migrations
echo ""
echo "Running database migrations..."
docker compose -f docker-compose.dev.yml exec api npx prisma migrate deploy --schema packages/db/prisma/schema.prisma || {
  echo "Migration failed — trying db push instead..."
  docker compose -f docker-compose.dev.yml exec api npx prisma db push --schema packages/db/prisma/schema.prisma
}

echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "  Frontend: http://localhost:3000"
echo "  API:      http://localhost:3001"
echo "  API Docs: http://localhost:3001/api/docs"
echo ""
echo "  Default credentials:"
echo "  Ashwani:  ashwani@nexgenpharmasolutions.com / Admin@123456"
echo "  Pratham:  pratham.s@nexgenpharmasolutions.com / Admin@123456"
echo ""
