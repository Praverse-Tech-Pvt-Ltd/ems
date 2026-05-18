# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests
COPY package*.json turbo.json ./
COPY packages/db/package*.json ./packages/db/
COPY apps/api/package*.json ./apps/api/

RUN npm ci --workspace=apps/api --workspace=packages/db --ignore-scripts

# Copy source
COPY packages/db ./packages/db
COPY apps/api    ./apps/api

# Generate Prisma client then build API
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# ── Stage 2: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json turbo.json ./
COPY packages/db/package*.json ./packages/db/
COPY apps/api/package*.json ./apps/api/

RUN npm ci --workspace=apps/api --workspace=packages/db --omit=dev --ignore-scripts

COPY --from=builder /app/apps/api/dist      ./apps/api/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY packages/db/prisma ./packages/db/prisma

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
