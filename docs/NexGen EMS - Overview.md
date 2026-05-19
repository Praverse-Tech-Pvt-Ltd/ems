---
title: NexGen EMS - Overview
tags:
  - nexgen
  - ems
  - project
aliases:
  - NexGen Overview
  - EMS Overview
date: 2026-05-18
status: active
---

# NexGen EMS

> [!abstract] What is NexGen EMS?
> A full-stack **Employee Management System** built as a Turborepo monorepo. It handles attendance (with face recognition), leave management, expenses, payroll, and reporting.

## Quick Links

- [[NexGen EMS - Local Dev Setup|Local Dev Setup]]
- [[NexGen EMS - Architecture|Architecture & Services]]
- [[NexGen EMS - AWS Rekognition Setup|AWS Rekognition Setup]]

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Backend API | NestJS (Node 20) |
| Face Recognition | AWS Rekognition + FastAPI |
| Database | PostgreSQL via Neon (serverless) |
| Cache / Queue | Redis via Upstash |
| ORM | Prisma |
| Monorepo | Turborepo |
| Auth | JWT (access 15m + refresh 7d) |

---

## Default Credentials

> [!warning] Change passwords before any public deployment

### Super Admin
| Field | Value |
|-------|-------|
| Email | `ashwani@nexgenpharmasolutions.com` |
| Password | `Admin@123456` |
| Employee Code | `NXG-001` |
| Designation | Managing Director |
| Role | `SUPER_ADMIN` |

### Admin
| Field | Value |
|-------|-------|
| Email | `pratham.s@nexgenpharmasolutions.com` |
| Password | `Admin@123456` |
| Employee Code | `NXG-002` |
| Designation | Director |
| Role | `SUPER_ADMIN` |
| Authority | Approval/rejection authority for all employee-submitted requests, including leaves, expenses, payroll, documents, invoices, attendance regularization, WFH, advances, assets, and travel approvals. |

---

## Leave Structure

| Type | Code | Days |
|------|------|------|
| Casual Leave | CL | 7 |
| Sick Leave | SL | 7 |
| Paid Leave | PL | 14 |
| On Duty | OD | 0 |
| Unpaid Leave | UL | 0 |

Leave balances are annual and do not roll over. Unused paid leave (PL) is payable by the company as part of payroll/HR settlement. Interns do not receive the permanent employee leave allocation during internship; internship-period leave is deductible/unpaid.

---

## Key Features

- [x] JWT authentication with refresh tokens
- [x] Face enrollment + punch-in via AWS Rekognition
- [x] Geo-fence attendance (soft — passes if no offices configured)
- [x] Leave requests with manager approval workflow
- [x] Expense claims with L1 + Finance approval
- [x] Salary slips and payroll management
- [x] Role-based access (SUPER_ADMIN / ADMIN / MANAGER / EMPLOYEE)
- [x] First-login face enrollment popup (mandatory)
- [x] Soft face verification (punch-in proceeds if FR unavailable)
