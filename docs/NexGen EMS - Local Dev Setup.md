---
title: NexGen EMS - Local Dev Setup
tags:
  - nexgen
  - setup
  - dev
date: 2026-05-18
---

# Local Dev Setup

← [[NexGen EMS - Overview|Overview]] | [[NexGen EMS - Architecture|Architecture]]

---

## Prerequisites

- Node.js 20+
- Python 3.11+
- npm 10+

> [!tip] No local PostgreSQL or Redis needed
> The project connects to **Neon** (cloud Postgres) and **Upstash** (cloud Redis) — no local database setup required.

---

## 1. Install Dependencies

```bash
# From repo root
npm install
```

---

## 2. Environment Files

### API — `apps/api/.env`

```env
DATABASE_URL=postgresql://<user>:<password>@<host>-pooler.<region>.neon.tech/<dbname>?sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://<user>:<password>@<host>.<region>.neon.tech/<dbname>?sslmode=require
REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=<32-char key>
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=uploads
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=noreply@nexgenpharmasolutions.com
RESEND_FROM_NAME=NexGen Pharma EMS
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### Web — `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 3. Run Database Migrations

```bash
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

---

## 4. Seed the Database

```bash
npx ts-node packages/db/prisma/seed.ts
```

Creates:
- `ashwani@nexgenpharmasolutions.com` / `Admin@123456` (SUPER_ADMIN, NXG-001)
- `pratham.s@nexgenpharmasolutions.com` / `Admin@123456` (ADMIN, NXG-002)
- Leave balances: CL=7, SL=7, PL=14, OD=0, UL=0

---

## 5. Start All Services

Open **3 separate terminals**:

```bash
# Terminal 1 — NestJS API
cd apps/api
npm run start:dev

# Terminal 2 — Next.js Web
cd apps/web
npm run dev

# Terminal 3 — Face Service
cd apps/face-service
.\venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# On Mac/Linux:
# ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 6. Set Up Face Service venv (first time)

```bash
cd apps/face-service
python -m venv venv

# Windows
.\venv\Scripts\pip install -r requirements.txt

# Mac/Linux
./venv/bin/pip install -r requirements.txt
```

---

## Verify Everything is Running

| Check | URL |
|-------|-----|
| API health | http://localhost:3001/health |
| API Swagger | http://localhost:3001/api/docs |
| Face service health | http://localhost:8000/health |
| Web app | http://localhost:3000 |

---

## Common Issues

> [!bug] `compression is not a function`
> Use `const compression = require('compression')` not `import compression from 'compression'` in `apps/api/src/main.ts`.

> [!bug] Face service `pydantic_settings` validation error
> Missing env vars. Ensure all 5 vars in `apps/face-service/.env` are set.

> [!bug] `channel_binding=require` error in face service
> The face service uses `psycopg2` which doesn't support this flag. The `.env` for face-service uses the **direct URL without** `channel_binding`.

> [!bug] Geo-fence blocking punch-in
> Expected if no office locations are configured in DB — geo-fence returns `true` (pass-through) when the `office_locations` table is empty.
