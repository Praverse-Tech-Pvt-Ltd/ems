CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "employee_documents"
  ADD COLUMN "status" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewed_by" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ,
  ADD COLUMN "rejection_reason" TEXT;

CREATE TABLE "policy_acknowledgements" (
  "id" TEXT NOT NULL,
  "policy_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "policy_acknowledgements_policy_id_employee_id_key" ON "policy_acknowledgements"("policy_id", "employee_id");

ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
