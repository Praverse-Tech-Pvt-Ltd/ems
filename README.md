# NexGen EMS — Employee Management System

Full-stack monorepo for **NexGen Pharma Solutions Pvt Ltd**.

## Stack
# NexGen EMS — Employee Management System

Full-stack monorepo for **NexGen Pharma Solutions Pvt Ltd**.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS (brutalist design system) |
| Backend API | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| File Storage | Local disk in dev, S3-ready abstraction |
| PDF | PDFKit salary slip generation |
| Monorepo | Turborepo + npm workspaces |

---

## Project Structure

```
nexgen-ems/
├── apps/
│   ├── web/                    # Next.js 14 frontend         → port 3000
│   └── api/                    # NestJS REST API             → port 3001
├── packages/
│   ├── db/                     # Prisma schema + migrations
│   └── types/                  # Shared TypeScript types
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## Quick Start

### Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 20+ | `node -v` |
| npm | 11+ | `npm -v` |
| Docker Desktop | Latest | Must be running |

---

### 1 — Install Node Dependencies

```powershell
npm install
```

---

### 2 — Environment Files

**`apps/api/.env`**
```env
DATABASE_URL=postgresql://nexgen:nexgen_dev_pass@localhost:5433/nexgen_ems?schema=public
DIRECT_URL=postgresql://nexgen:nexgen_dev_pass@localhost:5433/nexgen_ems?schema=public
REDIS_URL=redis://localhost:6380
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_REFRESH_SECRET=dev_refresh_secret_change_in_production
ENCRYPTION_KEY=dev_aes_key_32chars_change_prod!!
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=uploads
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### 3 — Start Infrastructure

```powershell
docker compose up postgres redis -d
```

Verify containers are up:
```powershell
docker compose ps
```

---

### 4 — Run Database Migrations

```powershell
# Load env vars into the current shell session (PowerShell)
Get-Content apps\api\.env | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_ -split '=', 2
  if ($name) { Set-Item -Path "Env:$name" -Value $value }
}

# Apply migrations
npm --workspace @nexgen/db exec prisma migrate deploy

# Generate Prisma client
npm --workspace @nexgen/db run db:generate
```

Or with Turbo shortcuts:
```powershell
npm run db:migrate
npm run db:generate
```

---

### 5 — Start API and Frontend

**Option A — Individually (recommended for debugging):**

```powershell
# Terminal 1 — NestJS API
npm --workspace @nexgen/api run dev

# Terminal 2 — Next.js frontend
npm --workspace @nexgen/web run dev
```

**Option B — Together via Turborepo:**

```powershell
npm run dev
```

---

### 6 — Service URLs

| Service | URL |
|---|---|
| Web App | http://localhost:3000 |
| NestJS API | http://localhost:3001 |
| Swagger / API Docs | http://localhost:3001/api/docs |
| Prisma Studio | http://localhost:5555 (run `npm run db:studio`) |

---

## Default Credentials

### Super Admin
| Field | Value |
|---|---|
| Email | `ashwani@nexgenpharmasolutions.com` |
| Password | `Admin@123456` |
| Designation | Managing Director |
| Role | `SUPER_ADMIN` — full access including audit logs and destructive operations |

### Admin
| Field | Value |
|---|---|
| Email | `pratham.s@nexgenpharmasolutions.com` |
| Password | `Admin@123456` |
| Designation | Director |
| Role | `SUPER_ADMIN` — approval/rejection authority for employee requests, leaves, expenses, payroll, documents, invoices, attendance regularization, and company workflows |

---

## API Reference

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Email + password sign-in |
| `POST` | `/auth/refresh` | Public | Refresh access token |
| `POST` | `/auth/logout` | Bearer | Revoke refresh token |
| `POST` | `/auth/forgot-password` | Public | Reset password by email (no email service needed — direct reset for internal use) |
| `PATCH` | `/auth/change-password` | Bearer | Change password with current password verification |

### Attendance

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/attendance/punch-in` | Bearer | Manual punch-in |
| `POST` | `/attendance/punch-out` | Bearer | Manual punch-out |
| `GET` | `/attendance/today` | Bearer | Today's own attendance record |
| `GET` | `/attendance/my` | Bearer | Own attendance history |
| `GET` | `/attendance/employee/:id` | Manager+ | Employee attendance history |
| `GET` | `/attendance` | Admin+ | All attendance records |
| `PATCH` | `/attendance/:id/regularize` | Admin+ | Regularize an attendance entry |

### Payroll

| Method | Path | Description |
|---|---|---|
| `GET` | `/salary/structures` | List salary structures |
| `POST` | `/salary/structures/:employeeId` | Create salary structure |
| `POST` | `/salary/slips/generate` | Generate payroll for a period |
| `PATCH` | `/salary/slips/:id/approve` | Approve salary slip |
| `PATCH` | `/salary/slips/:id/reject` | Reject salary slip |
| `PATCH` | `/salary/slips/:id/transfer` | Mark as transferred |
| `GET` | `/salary/slips/:id/pdf` | Download PDF salary slip |

### Employee Onboarding & Documents

| Method | Path | Description |
|---|---|---|
| `GET` | `/employees/me/onboarding` | Onboarding checklist + completion % |
| `PATCH` | `/employees/me/bank-details` | Submit bank + statutory details |
| `POST` | `/employees/me/documents/upload` | Upload Aadhaar / PAN / photo |
| `GET` | `/employees/documents/review` | Admin — list pending documents |
| `PATCH` | `/employees/documents/:id/review` | Admin — approve or reject |

### Company OS

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/corporate/settings/:key` | Company-wide settings |
| `GET/POST` | `/corporate/holidays` | Holiday calendar |
| `GET/POST` | `/corporate/policies` | HR policies |
| `POST` | `/corporate/policies/:id/acknowledge` | Acknowledge a policy |
| `GET/POST` | `/corporate/tasks/my` | Employee tasks |
| `GET/POST` | `/corporate/chat/channels` | Chat channels |
| `GET/POST` | `/corporate/chat/channels/:id/messages` | Channel messages |
| `GET/POST` | `/corporate/lifecycle` | Employee lifecycle events |

---

## Common Development Commands

```powershell
# Run everything (frontend + api) via Turborepo
npm run dev

# Run individual services
npm --workspace @nexgen/web run dev        # Frontend only
npm --workspace @nexgen/api run dev        # API only

# Type checking (all workspaces)
npm run type-check

# Linting (all workspaces)
npm run lint

# Database — generate Prisma client after schema change
npm run db:generate
npm --workspace @nexgen/db exec prisma generate

# Database — apply pending migrations
npm run db:migrate
npm --workspace @nexgen/db exec prisma migrate deploy

# Database — create a new migration (after editing schema.prisma)
npm --workspace @nexgen/db exec prisma migrate dev --name <migration-name>

# Database — open Prisma Studio UI
npm run db:studio

# Database — reset (drops all data and re-runs migrations)
npm --workspace @nexgen/db exec prisma migrate reset

# Docker — start only DB + cache
docker compose up postgres redis -d

# Docker — start full stack
docker compose up -d

# Docker — stop all containers
docker compose down

# Docker — stop and wipe all volumes (full reset)
docker compose down -v

# Docker — tail postgres logs
docker compose logs -f postgres
```

---

## Features

- **Attendance** — manual punch in/out.
- **Forgot Password** — self-service password reset from the login page (no email service required for internal use).
- **Change Password** — authenticated password change from Profile / Settings.
- **Employee onboarding** — bank details, Aadhaar, PAN, and photograph with checklist tracking.
- **Payroll** — salary structures, payroll generation, incentives, deductions, approved reimbursements, approval/rejection/transfer workflow, branded PDF salary slips.
- **Leaves** — annual CL/SL/PL balances, no rollover, paid-leave payout tracking, intern unpaid/deductible leave, and approval workflow.
- **Expenses** — expense claims with receipt uploads and approval.
- **Company OS** — policies with acknowledgements, holiday calendar, tasks, lifecycle events, direct and group chat with admin monitoring.
- **Audit log** — sensitive changes and key workflow events recorded.
- **Geo-fencing** — attendance punch-in restricted to company geofence.
- **Holiday-aware payroll** — working day calculation respects the holiday calendar.
- **AES-256-GCM encryption** — bank details and PAN encrypted at rest using `ENCRYPTION_KEY`.

---

## Branding Assets

```
apps/web/public/brand/nexgen-logo-full.png
apps/web/public/brand/nexgen-logo-mark.png
apps/api/assets/brand/nexgen-logo-full.png
apps/api/assets/brand/nexgen-logo-mark.png
```

Salary slip PDF displays: **NEXGEN PHARMA SOLUTIONS PVT LTD**

## Payroll Signatures

Place signature PNGs at:
```
apps/api/assets/signatures/ashwani-shrivastav.png
apps/api/assets/signatures/pratham-shrivastav.png
```

The API maps the approver's name to the signature file when a slip is approved.

## Local File Storage

```env
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=uploads
```

Documents stored at: `uploads/employee-documents/<employee-code>/`  
Protected access: `GET /files?key=<stored-key>`

---

## Notes

- Do not commit `.env`, `.env.local`, `uploads/`, `.next/`, `dist/`, or `node_modules/`.
- `tsconfig.tsbuildinfo` are local build artifacts — keep out of commits.
- For production: replace all dev secrets, add an SMTP provider for password reset emails, and switch `STORAGE_DRIVER=s3`.
