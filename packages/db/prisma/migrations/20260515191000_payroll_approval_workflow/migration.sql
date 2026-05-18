-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'TRANSFERRED');

-- AlterTable
ALTER TABLE "salary_slips"
  ADD COLUMN "base_salary" DECIMAL(12,2),
  ADD COLUMN "incentives" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "reimbursements" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "signature_name" TEXT,
  ADD COLUMN "signature_title" TEXT,
  ADD COLUMN "approved_by" TEXT,
  ADD COLUMN "approved_at" TIMESTAMPTZ,
  ADD COLUMN "transferred_at" TIMESTAMPTZ,
  ADD COLUMN "payment_ref" TEXT,
  ADD COLUMN "email_sent_at" TIMESTAMPTZ,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "salary_slips" ALTER COLUMN "slip_pdf_s3_key" DROP NOT NULL;

-- CreateTable
CREATE TABLE "salary_structures" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "basic" DECIMAL(12,2) NOT NULL,
  "hra" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "pf_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "professional_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "effective_from" DATE NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMPTZ,
  "signature_name" TEXT,
  "signature_title" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_employee_id_effective_from_key" ON "salary_structures"("employee_id", "effective_from");
CREATE INDEX "salary_structures_employee_id_idx" ON "salary_structures"("employee_id");

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
