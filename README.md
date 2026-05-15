# NexGen EMS — Employee Management System

Full-stack monorepo for NexGen Pharma Solutions EMS.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend API | NestJS, TypeScript, Prisma |
| Face Recognition | Python FastAPI + DeepFace / AWS Rekognition |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| File Storage | AWS S3 |
| Real-time | Socket.io |

## Quick Start (Local — No Docker for App Services)

Docker is used **only** for PostgreSQL and Redis. The three application services (frontend, API, face service) run natively on your machine.

### 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | `node -v` to verify |
| Docker Desktop | For PostgreSQL + Redis only |
| Python 3.11 | For face service — **not** 3.12/3.13 (TensorFlow incompatible) |

### 2. Environment Files

Two files must exist before starting services:

**`apps/api/.env`** — copy from example and fill in secrets:
```bash
cp apps/api/.env.example apps/api/.env
```

**`apps/web/.env.local`** — create with:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Install Dependencies

```powershell
# From the repo root
npm install
```

### 4. Start Infrastructure (PostgreSQL + Redis)

```powershell
docker compose up postgres redis -d
```

### 5. Run Database Migrations and Seed

```powershell
cd packages/db
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
cd ../..
```

### 6. Start the API (NestJS) — open a dedicated terminal

```powershell
cd apps/api
npm run dev
# Runs on http://localhost:3001
# Swagger docs at http://localhost:3001/api/docs
```

### 7. Start the Frontend (Next.js) — open a dedicated terminal

```powershell
cd apps/web
npm run dev
# Runs on http://localhost:3000
```

### 8. Start the Face Service (Python) — open a dedicated terminal

**One-time setup — Windows Long Path must be enabled first:**

1. Open PowerShell as Administrator and run:
   ```powershell
   Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1
   ```
2. Restart your terminal.

**Create a Python 3.11 virtual environment:**
```powershell
cd apps/face-service
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Start the service:**
```powershell
uvicorn app.main:app --port 8000 --reload
# Runs on http://localhost:8000
```

### 9. Default Admin Credentials

| Field | Value |
|---|---|
| Email | `admin@nexgen.in` |
| Password | `Admin@123456` |
| OTP / 2FA | Not enabled by default — leave the field blank on the login screen |

### 10. Services

| Service | URL |
|---|---|
| Web App | http://localhost:3000 |
| API | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/api/docs |
| Face Service | http://localhost:8000 |

## Project Structure

```
nexgen-ems/
├── apps/
│   ├── web/              # Next.js 14 frontend
│   ├── api/              # NestJS REST API
│   └── face-service/     # Python FastAPI face recognition
├── packages/
│   ├── db/               # Prisma schema + migrations
│   ├── types/            # Shared TypeScript types + Zod schemas
│   └── config/           # Shared ESLint, tsconfig
├── infrastructure/       # Docker, Terraform
└── docker-compose.yml
```

## Development Phases

- **Phase 1** (Weeks 1–4): Auth, Employee Profiles, Role Management
- **Phase 2** (Weeks 5–8): Face Enrollment, Punch-in/out, Attendance Dashboard
- **Phase 3** (Weeks 9–11): Leaves, Requests, Notifications
- **Phase 4** (Weeks 12–14): Expenses, Invoices, Salary Slips
- **Phase 5** (Weeks 15–16): Reports, Audit Trail, Security Hardening
- **Phase 6** (Weeks 17–18): PWA, WhatsApp, Analytics

## Key Features

- Face recognition attendance with GPS geo-fencing
- Multi-level approval workflows (expenses, leaves, requests)
- Real-time notifications via Socket.io
- Role-based access: Employee / Manager / Admin / Super Admin
- Full audit trail on all state-changing actions
- JWT auth with refresh token rotation + optional TOTP 2FA
- AES-256 encryption for sensitive fields (bank account, PAN)
