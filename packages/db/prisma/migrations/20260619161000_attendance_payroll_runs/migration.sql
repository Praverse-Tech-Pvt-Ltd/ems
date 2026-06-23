-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payroll_runs" (
  "id" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
  "generated_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMPTZ,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_employees" (
  "id" TEXT NOT NULL,
  "payroll_run_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "month_days" INTEGER NOT NULL,
  "working_days" INTEGER NOT NULL,
  "paid_days" DECIMAL(5,2) NOT NULL,
  "lop_days" DECIMAL(5,2) NOT NULL,
  "present_days" INTEGER NOT NULL DEFAULT 0,
  "late_days" INTEGER NOT NULL DEFAULT 0,
  "wfh_days" INTEGER NOT NULL DEFAULT 0,
  "half_days" INTEGER NOT NULL DEFAULT 0,
  "leave_days" INTEGER NOT NULL DEFAULT 0,
  "holiday_days" INTEGER NOT NULL DEFAULT 0,
  "week_off_days" INTEGER NOT NULL DEFAULT 0,
  "absent_days" INTEGER NOT NULL DEFAULT 0,
  "missing_punch_days" INTEGER NOT NULL DEFAULT 0,
  "base_salary" DECIMAL(12,2) NOT NULL,
  "earned_base_salary" DECIMAL(12,2) NOT NULL,
  "incentives" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "reimbursements" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "gross_salary" DECIMAL(12,2) NOT NULL,
  "pf_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "esic_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "professional_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(12,2) NOT NULL,
  "net_payable" DECIMAL(12,2) NOT NULL,
  "calculation_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_run_employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_month_year_key" ON "payroll_runs"("month", "year");
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");
CREATE UNIQUE INDEX "payroll_run_employees_payroll_run_id_employee_id_key" ON "payroll_run_employees"("payroll_run_id", "employee_id");
CREATE INDEX "payroll_run_employees_employee_id_idx" ON "payroll_run_employees"("employee_id");

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
