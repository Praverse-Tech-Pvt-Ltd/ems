# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Prisma generate validates datasource env vars while building, but it does
# not connect to the database. Runtime secrets still come from the host.
ENV DATABASE_URL="postgresql://nexgen:nexgen@localhost:5432/nexgen_ems?schema=public"
ENV DIRECT_URL="postgresql://nexgen:nexgen@localhost:5432/nexgen_ems?schema=public"

# Copy workspace manifests for dependency resolution
COPY package*.json turbo.json ./
COPY packages/db/package*.json    ./packages/db/
COPY packages/types/package*.json ./packages/types/
COPY apps/api/package*.json       ./apps/api/

RUN npm ci --workspace=apps/api --workspace=packages/db --workspace=packages/types --ignore-scripts

# Copy all source
COPY packages/db    ./packages/db
COPY packages/types ./packages/types
COPY apps/api       ./apps/api

# Generate Prisma client then compile TypeScript
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# ── Stage 2: production ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json turbo.json ./
COPY packages/db/package*.json    ./packages/db/
COPY packages/types/package*.json ./packages/types/
COPY apps/api/package*.json       ./apps/api/

RUN npm ci --workspace=apps/api --workspace=packages/db --workspace=packages/types --omit=dev --ignore-scripts

COPY --from=builder /app/apps/api/dist        ./apps/api/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/db/prisma   ./packages/db/prisma

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
