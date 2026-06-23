-- CreateTable
CREATE TABLE "monthly_attendance_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
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
    "designated_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "actual_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "gross_overtime_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "gross_shortfall_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtime_credit_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "balanced_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "net_overtime_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "net_shortfall_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtime_balance_factor" DECIMAL(4,2) NOT NULL DEFAULT 0.50,
    "late_allowance_monthly" INTEGER NOT NULL DEFAULT 2,
    "late_allowance_used" INTEGER NOT NULL DEFAULT 0,
    "late_converted_to_half_day" INTEGER NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_attendance_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_attendance_balances_employee_id_month_year_key" ON "monthly_attendance_balances"("employee_id", "month", "year");

-- CreateIndex
CREATE INDEX "monthly_attendance_balances_month_year_idx" ON "monthly_attendance_balances"("month", "year");

-- CreateIndex
CREATE INDEX "monthly_attendance_balances_employee_id_idx" ON "monthly_attendance_balances"("employee_id");

-- AddForeignKey
ALTER TABLE "monthly_attendance_balances" ADD CONSTRAINT "monthly_attendance_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
