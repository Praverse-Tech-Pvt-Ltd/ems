-- Company-wide, admin-configurable monthly attendance allowances,
-- replacing the hardcoded MAX_LATE_PM / MAX_EARLY_PM / MAX_HALFDAY_PM
-- constants previously in attendance.service.ts.
CREATE TABLE "attendance_policy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "max_late_per_month" INTEGER NOT NULL DEFAULT 2,
    "max_early_out_per_month" INTEGER NOT NULL DEFAULT 2,
    "max_half_days_per_month" INTEGER NOT NULL DEFAULT 4,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policy_pkey" PRIMARY KEY ("id")
);

INSERT INTO "attendance_policy" ("id", "updated_at") VALUES ('default', CURRENT_TIMESTAMP);
