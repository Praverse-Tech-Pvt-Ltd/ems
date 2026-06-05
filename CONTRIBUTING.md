# Contributing to NexGen EMS

NexGen EMS is a pharma consultancy Employee Management System built for Nexgen Pharma Solutions Pvt Ltd.

---

## Prerequisites

- **Node.js 20+** (`node --version`)
- **npm 10+** (`npm --version`)
- **Docker Desktop** (for local database + services)
- **Git**

---

## Quick Start (Docker — Recommended for Team)

```bash
git clone https://github.com/Praverse-Tech-Pvt-Ltd/ems.git
cd ems

# Run setup script (creates .env, starts Docker, runs migrations)
chmod +x scripts/setup.sh
./scripts/setup.sh
```

After setup:
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| API Docs | http://localhost:3001/api/docs |

---

## Quick Start (Local Dev without Docker)

```bash
# 1. Clone and install
git clone https://github.com/Praverse-Tech-Pvt-Ltd/ems.git
cd ems
npm install

# 2. Start local DB + Redis (requires Docker just for this)
docker compose up postgres redis -d

# 3. Set up environment
cp .env.example apps/api/.env
# Edit apps/api/.env and fill DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY

# 4. Generate Prisma client and push schema
npx prisma generate --schema=packages/db/prisma/schema.prisma
npx prisma db push --schema=packages/db/prisma/schema.prisma

# 5. Seed initial data
npx ts-node packages/db/prisma/seed.ts

# 6. Start all services
npm run dev
```

---

## Environment Variables

Copy `.env.example` to `apps/api/.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon (prod) or `postgresql://nexgen:nexgen_dev_pass@localhost:5433/nexgen_ems` (local) |
| `DIRECT_URL` | ✅ | Same host, no pgbouncer |
| `REDIS_URL` | ✅ | Upstash (prod) or `redis://localhost:6380` (local) |
| `JWT_SECRET` | ✅ | 64+ char random string |
| `JWT_REFRESH_SECRET` | ✅ | 64+ char random string |
| `ENCRYPTION_KEY` | ✅ | Exactly 32 chars |
| `GEMINI_API_KEY` | ✅ | From [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `RESEND_API_KEY` | ⚠️ | For email — get from [resend.com](https://resend.com) |
| `OFFICE_LAT/LNG` | ⚠️ | Your office GPS coordinates for geo-fence |
| `OWNER_EMPLOYEE_IDS` | ⚠️ | Comma-separated IDs for Ashwani + Pratham (set after seeding) |

---

## Login Credentials (Seeded)

| Employee | Email | Password | Role |
|----------|-------|----------|------|
| Ashwani Shrivastav | ashwani@nexgenpharmasolutions.com | Admin@123456 | SUPER_ADMIN |
| Pratham Shrivastav | pratham.s@nexgenpharmasolutions.com | Admin@123456 | SUPER_ADMIN |
| Chandni Jha | chandni.jha@nexgenpharmasolutions.com | Chandni@NEX2026 | EMPLOYEE |
| Dev Patel | dev.patel@praversetech.com | Dev@NEX2026 | EMPLOYEE |
| Maanav Shah | maanav.shah@praversetech.com | Maanav@NEX2026 | EMPLOYEE |
| Shifa Mobh | shifa.mobh@nexgenpharmasolutions.com | Shifa@NEX2026 | EMPLOYEE |

---

## Project Structure

```
ems/
├── apps/
│   ├── api/          # NestJS backend (port 3001)
│   ├── web/          # Next.js frontend (port 3000)
│   └── face-service/ # Python FastAPI face recognition (port 8000)
├── packages/
│   ├── db/           # Prisma schema + migrations
│   └── types/        # Shared TypeScript types
├── .github/workflows/ # CI/CD
├── scripts/           # setup.sh
├── docker-compose.yml         # Local dev (postgres + redis only)
├── docker-compose.dev.yml     # Full dev stack (all services)
└── docker-compose.prod.yml    # Production stack
```

---

## Database Migrations

```bash
# After changing schema.prisma:
npx prisma db push --schema=packages/db/prisma/schema.prisma   # dev (fast)
# OR for production migrations:
npx prisma migrate dev --schema=packages/db/prisma/schema.prisma --name=your_migration_name

# Regenerate client after schema changes:
npx prisma generate --schema=packages/db/prisma/schema.prisma
```

---

## Adding New Features

1. **Backend module**: Create `apps/api/src/modules/<feature>/` with controller, service, module, DTOs
2. **Register**: Add module to `apps/api/src/app.module.ts`
3. **Schema**: Add models to `packages/db/prisma/schema.prisma`, run `prisma db push`
4. **Frontend**: Create page in `apps/web/src/app/(app)/<feature>/page.tsx`
5. **Sidebar**: Add nav item to `apps/web/src/components/layouts/AppSidebar.tsx`

---

## Intelligence Modules (Company Tracking)

| Feature | Route | Access |
|---------|-------|--------|
| Company Dashboard | `/companies` | All |
| Company Detail + Audit | `/companies/[id]` | All |
| Meeting Notes (AI) | `/meeting-notes` | All |
| Work Updates (AI) | `/work-updates` | All |
| Follow-up Tasks | `/follow-ups` | All |
| Calendar | `/calendar` | All |
| Management Review | `/management-review` | Admin+ |
| AI Chat | `/chat-ai` | Owner only |
| Owner Dashboard | `/owner` | Owner only |

---

## Tier 3 Integrations (Planned — Not Built)

See `apps/api/src/modules/zoho-sync/zoho-sync.module.ts` for architecture notes.

- **Zoho Mail** → populate `ClientCommunication.zohoEmailId`
- **Zoho Calendar** → sync `CalendarEvent.zohoEventId`
- **WhatsApp** → `ClientCommType.WHATSAPP` entry point in `ClientCommunicationsService`
- **AI Document OCR** → `CompanyDocument` processing pipeline

Required env vars when ready:
```
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=
ZOHO_REFRESH_TOKEN=
WHATSAPP_API_KEY=
```

---

## CI/CD

GitHub Actions runs on every PR:
- `prisma validate` — schema validation
- `tsc --noEmit` — type checks on API and Web

PRs must pass CI before merging to `main`.

---

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes, ensure `npx tsc --noEmit --skipLibCheck` passes
3. Open PR against `main` / `master`
4. CI must pass
5. Get review from Pratham or Ashwani

---
*NexGen Pharma Solutions Pvt Ltd — Internal EMS*
