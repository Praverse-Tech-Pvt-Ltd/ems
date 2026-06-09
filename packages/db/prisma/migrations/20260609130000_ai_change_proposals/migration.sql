CREATE TYPE "AIChangeProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "AIChangeProposalType" AS ENUM (
  'WORK_UPDATE',
  'MEETING_NOTE',
  'CLIENT_COMMUNICATION',
  'FOLLOW_UP_TASK',
  'CALENDAR_EVENT',
  'COMPANY_STAGE_UPDATE'
);

CREATE TABLE "ai_change_proposals" (
  "id" TEXT NOT NULL,
  "proposal_type" "AIChangeProposalType" NOT NULL,
  "status" "AIChangeProposalStatus" NOT NULL DEFAULT 'PENDING',
  "submitted_by" TEXT NOT NULL,
  "raw_input" TEXT NOT NULL,
  "target_entity" TEXT,
  "target_entity_id" TEXT,
  "proposed_data" JSONB NOT NULL,
  "confidence" INTEGER,
  "ai_reason" TEXT,
  "applied_entity" TEXT,
  "applied_entity_id" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_change_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_change_proposals_status_created_at_idx" ON "ai_change_proposals"("status", "created_at");
CREATE INDEX "ai_change_proposals_submitted_by_idx" ON "ai_change_proposals"("submitted_by");

ALTER TABLE "ai_change_proposals"
  ADD CONSTRAINT "ai_change_proposals_submitted_by_fkey"
  FOREIGN KEY ("submitted_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_change_proposals"
  ADD CONSTRAINT "ai_change_proposals_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
