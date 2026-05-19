# NexGen EMS - Employee Management System

Full-stack monorepo for **NexGen Pharma Solutions Pvt Ltd** EMS.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend API | NestJS, TypeScript, Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| File Storage | Local disk in dev, S3-ready service abstraction |
| Face Recognition | Python FastAPI + DeepFace / AWS Rekognition integration point |
| PDF | PDFKit salary slip generation |

## Quick Start

Docker is used for PostgreSQL and Redis. The frontend and API run natively.

### 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | `node -v` to verify |
| Docker Desktop | PostgreSQL + Redis |
| Python 3.11 | Needed only for the face service |

### 2. Environment Files

Use the actual local env files, not only the examples.

`apps/api/.env`

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

`apps/web/.env` and `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Install Dependencies

```powershell
npm install
```

### 4. Start Infrastructure

```powershell
docker compose up postgres redis -d
```

### 5. Run Migrations

```powershell
Get-Content apps\api\.env | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_ -split '=', 2
  if ($name) { Set-Item -Path "Env:$name" -Value $value }
}
npm --workspace @nexgen/db exec prisma migrate deploy
npm --workspace @nexgen/db run db:generate
```

### 6. Start Services

```powershell
npm --workspace @nexgen/api run dev
npm --workspace @nexgen/web run dev
```

| Service | URL |
|---|---|
| Web App | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger Docs | http://localhost:3001/api/docs |

## Default Credentials

### Super Admin
| Field | Value |
|---|---|
| Email | `ashwani@nexgenpharmasolutions.com` |
| Password | `Admin@123456` |
| Role | `SUPER_ADMIN` — full access including audit logs and destructive operations |

### Admin
| Field | Value |
|---|---|
| Email | `pratham.s@nexgenharmasolutions.com` |
| Password | `Admin@123456` |
| Role | `ADMIN` — employee management, payroll, approvals |

> OTP / 2FA: leave blank unless explicitly enabled per user.

## Major Features

- Face recognition attendance with geo-fencing.
- Employee onboarding with bank details, Aadhaar, PAN, photograph, and face capture.
- Local document uploads under `uploads/` in development.
- Admin document verification and rejection workflow.
- Salary structure management per employee.
- Payroll generation with incentives, deductions, approved reimbursements, approval, rejection, and transfer states.
- Branded salary slip PDF generation.
- Approval signature asset mapping.
- Company OS: policies, acknowledgements, holidays, settings, tasks, lifecycle, and organisation chat.
- Direct and group employee chat with admin monitoring access.
- Holiday-aware payroll day calculation.
- Holiday block for attendance punch-in.
- Working hours setting, defaulting to `09:30 - 18:00 IST`.
- Audit logging for sensitive changes and key workflows.
- AES-256-GCM encryption for new bank/PAN updates using `ENCRYPTION_KEY`.

## Branding Assets

Transparent logo assets are stored in:

```text
apps/web/public/brand/nexgen-logo-full.png
apps/web/public/brand/nexgen-logo-mark.png
apps/api/assets/brand/nexgen-logo-full.png
apps/api/assets/brand/nexgen-logo-mark.png
```

The salary slip PDF uses:

```text
NEXGEN PHARMA SOLUTIONS PVT LTD
```

## Payroll Signatures

Add signature PNGs later at these exact paths:

```text
apps/api/assets/signatures/ashwani-shrivastav.png
apps/api/assets/signatures/pratham-shrivastav.png
```

When salary is approved, the API maps the approver name to the expected signature asset and stores the signature key on the salary slip.

## Local File Storage

Development uploads use:

```text
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=uploads
```

Uploaded employee documents are stored under:

```text
uploads/employee-documents/<employee-code>/
```

Protected file access is exposed through:

```text
GET /api/v1/files?key=<stored-key>
```

## Important API Areas

### Payroll

```text
GET   /api/v1/salary/structures
POST  /api/v1/salary/structures/:employeeId
POST  /api/v1/salary/slips/generate
PATCH /api/v1/salary/slips/:id/approve
PATCH /api/v1/salary/slips/:id/reject
PATCH /api/v1/salary/slips/:id/transfer
GET   /api/v1/salary/slips/:id/pdf
```

### Employee Onboarding and Documents

```text
GET   /api/v1/employees/me/onboarding
PATCH /api/v1/employees/me/bank-details
POST  /api/v1/employees/me/documents/upload
GET   /api/v1/employees/documents/review
PATCH /api/v1/employees/documents/:id/review
```

### Company OS

```text
GET   /api/v1/corporate/settings
POST  /api/v1/corporate/settings/:key
GET   /api/v1/corporate/holidays
POST  /api/v1/corporate/holidays
GET   /api/v1/corporate/policies
POST  /api/v1/corporate/policies
POST  /api/v1/corporate/policies/:id/acknowledge
GET   /api/v1/corporate/tasks/my
POST  /api/v1/corporate/tasks
GET   /api/v1/corporate/chat/channels
POST  /api/v1/corporate/chat/channels
GET   /api/v1/corporate/chat/channels/:id/messages
POST  /api/v1/corporate/chat/channels/:id/messages
GET   /api/v1/corporate/lifecycle
POST  /api/v1/corporate/lifecycle
```

## Project Structure

```text
nexgen-ems/
  apps/
    web/              # Next.js frontend
    api/              # NestJS REST API
    face-service/     # Python face recognition service
  packages/
    db/               # Prisma schema and migrations
    types/            # Shared TypeScript types and schemas
  docker-compose.yml
```

## Notes

- Do not commit `.env`, `.env.local`, `uploads/`, `.next/`, `dist/`, or `node_modules/`.
- `tsconfig.tsbuildinfo` files are local build artifacts and should not be included in feature commits.
- For production, replace development secrets and configure real SMTP/S3 credentials.
