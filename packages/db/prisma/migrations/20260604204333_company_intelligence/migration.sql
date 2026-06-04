-- CreateEnum
CREATE TYPE "CompanyBusinessStatus" AS ENUM ('ACTIVE', 'DELAYED', 'AT_RISK', 'LOST', 'DORMANT');

-- CreateEnum
CREATE TYPE "CompanyCriticality" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TimelineEntryType" AS ENUM ('VISIT', 'AUDIT_PREP', 'DOCUMENT_REVIEW', 'CLIENT_CALL', 'INTERNAL_MEETING', 'EMPLOYEE_UPDATE', 'MEETING_NOTE', 'PENDING_TASK', 'COMPLETED_TASK', 'AI_SUMMARY', 'NEXT_ACTION', 'STATUS_CHANGE', 'ALERT');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('AUDIT', 'CLIENT_VISIT', 'INTERNAL_MEETING', 'DOCUMENT_DEADLINE', 'FOLLOW_UP', 'TASK_DEADLINE', 'OWNER_MEETING', 'RECURRING_REVIEW', 'AI_SUGGESTED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('MILD', 'MODERATE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WorkUpdateStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'NEEDS_CORRECTION');

-- DropForeignKey
ALTER TABLE "face_embeddings" DROP CONSTRAINT "face_embeddings_employee_id_fkey";

-- DropIndex
DROP INDEX "face_embeddings_embedding_idx";

-- AlterTable
ALTER TABLE "face_embeddings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "client_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "industry" TEXT DEFAULT 'Pharma',
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "website" TEXT,
    "business_status" "CompanyBusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "criticality" "CompanyCriticality" NOT NULL DEFAULT 'MEDIUM',
    "current_stage" TEXT,
    "responsible_employee_id" TEXT,
    "last_visit_date" DATE,
    "last_communication_date" DATE,
    "next_audit_date" DATE,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_reason" TEXT,
    "notes" TEXT,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_projects" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lead_employee_id" TEXT,
    "audit_type" TEXT,
    "audit_body" TEXT,
    "audit_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_status_history" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "business_status" "CompanyBusinessStatus" NOT NULL,
    "criticality" "CompanyCriticality" NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "summary" TEXT,
    "changed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_visits" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "visited_by" TEXT NOT NULL,
    "visit_date" DATE NOT NULL,
    "purpose" TEXT,
    "outcome" TEXT,
    "nextSteps" TEXT,
    "follow_up_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "entered_by" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "meeting_date" DATE NOT NULL,
    "extracted_data" JSONB,
    "company_name" TEXT,
    "employee_name" TEXT,
    "work_discussed" TEXT,
    "assigned_to" TEXT,
    "deadline" DATE,
    "current_status" TEXT,
    "pending_gap" TEXT,
    "follow_up_action" TEXT,
    "priority_level" TEXT,
    "owner_note" TEXT,
    "needs_admin_review" BOOLEAN NOT NULL DEFAULT false,
    "admin_reviewed_by" TEXT,
    "admin_reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_updates" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT,
    "raw_text" TEXT NOT NULL,
    "update_date" DATE NOT NULL,
    "extracted_data" JSONB,
    "company_name" TEXT,
    "task_completed" TEXT,
    "pending_task" TEXT,
    "progress" TEXT,
    "contribution" TEXT,
    "work_status" TEXT,
    "next_action" TEXT,
    "status" "WorkUpdateStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "needs_admin_review" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_timeline_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "entry_type" "TimelineEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "employee_id" TEXT,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "entry_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" "CalendarEventType" NOT NULL,
    "start_date" TIMESTAMPTZ NOT NULL,
    "end_date" TIMESTAMPTZ,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "company_id" TEXT,
    "assigned_to" TEXT,
    "created_by" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_rule" TEXT,
    "reminder_days" INTEGER,
    "is_ai_suggested" BOOLEAN NOT NULL DEFAULT false,
    "zoho_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_summaries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "summary_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_alerts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "alert_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_edit_history" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "edited_by" TEXT NOT NULL,
    "field_changed" TEXT NOT NULL,
    "original_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_companies_business_status_idx" ON "client_companies"("business_status");

-- CreateIndex
CREATE INDEX "client_companies_criticality_idx" ON "client_companies"("criticality");

-- CreateIndex
CREATE INDEX "client_companies_last_visit_date_idx" ON "client_companies"("last_visit_date");

-- CreateIndex
CREATE INDEX "company_timeline_entries_company_id_entry_date_idx" ON "company_timeline_entries"("company_id", "entry_date");

-- CreateIndex
CREATE INDEX "calendar_events_start_date_idx" ON "calendar_events"("start_date");

-- CreateIndex
CREATE INDEX "calendar_events_company_id_idx" ON "calendar_events"("company_id");

-- CreateIndex
CREATE INDEX "ai_summaries_company_id_summary_type_idx" ON "ai_summaries"("company_id", "summary_type");

-- CreateIndex
CREATE INDEX "company_alerts_company_id_is_resolved_idx" ON "company_alerts"("company_id", "is_resolved");

-- AddForeignKey
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_responsible_employee_id_fkey" FOREIGN KEY ("responsible_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_projects" ADD CONSTRAINT "company_projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_projects" ADD CONSTRAINT "company_projects_lead_employee_id_fkey" FOREIGN KEY ("lead_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_status_history" ADD CONSTRAINT "company_status_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_status_history" ADD CONSTRAINT "company_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_visits" ADD CONSTRAINT "company_visits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_visits" ADD CONSTRAINT "company_visits_visited_by_fkey" FOREIGN KEY ("visited_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_admin_reviewed_by_fkey" FOREIGN KEY ("admin_reviewed_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_updates" ADD CONSTRAINT "work_updates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_updates" ADD CONSTRAINT "work_updates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_updates" ADD CONSTRAINT "work_updates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_timeline_entries" ADD CONSTRAINT "company_timeline_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_timeline_entries" ADD CONSTRAINT "company_timeline_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_alerts" ADD CONSTRAINT "company_alerts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_alerts" ADD CONSTRAINT "company_alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_edit_history" ADD CONSTRAINT "attendance_edit_history_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_edit_history" ADD CONSTRAINT "attendance_edit_history_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
