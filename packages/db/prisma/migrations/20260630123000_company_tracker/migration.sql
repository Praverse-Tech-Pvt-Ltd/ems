CREATE TABLE IF NOT EXISTS "company_tracker_projects" (
  "id" TEXT NOT NULL,
  "tracking_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "client_type" TEXT NOT NULL,
  "project_type" TEXT NOT NULL,
  "regulatory_goal" TEXT NOT NULL,
  "current_stage" TEXT NOT NULL DEFAULT 'Not Started',
  "priority" TEXT NOT NULL DEFAULT 'Medium',
  "owner_id" TEXT,
  "start_date" DATE,
  "target_completion_date" DATE,
  "revised_target_date" DATE,
  "actual_completion_date" DATE,
  "current_status_summary" TEXT,
  "last_follow_up_date" DATE,
  "next_follow_up_date" DATE,
  "delay_reason" TEXT,
  "internal_remarks" TEXT,
  "client_remarks" TEXT,
  "source_company_project_id" TEXT,
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_tracker_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_tracker_assignments" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "role" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_tracker_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_requirements" (
  "id" TEXT NOT NULL,
  "requirement_code" TEXT NOT NULL,
  "tracker_project_id" TEXT NOT NULL,
  "company_project_id" TEXT,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "expected_output" TEXT,
  "assigned_to" TEXT,
  "reviewer_id" TEXT,
  "due_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'Not Started',
  "completion_percent" INTEGER NOT NULL DEFAULT 0,
  "document_required" BOOLEAN NOT NULL DEFAULT false,
  "document_uploaded" BOOLEAN NOT NULL DEFAULT false,
  "remarks" TEXT,
  "review_comments" TEXT,
  "delay_reason" TEXT,
  "last_updated_by" TEXT,
  "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tracker_follow_ups" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "tracker_project_id" TEXT,
  "requirement_id" TEXT,
  "description" TEXT NOT NULL,
  "responsible_id" TEXT,
  "last_follow_up_date" DATE,
  "next_follow_up_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'Open',
  "remarks" TEXT,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tracker_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tracker_documents" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "tracker_project_id" TEXT,
  "requirement_id" TEXT,
  "follow_up_id" TEXT,
  "title" TEXT NOT NULL,
  "document_type" TEXT NOT NULL,
  "version_no" TEXT,
  "remarks" TEXT,
  "file_link" TEXT,
  "uploaded_by" TEXT NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tracker_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tracker_activity_logs" (
  "id" TEXT NOT NULL,
  "company_id" TEXT,
  "tracker_project_id" TEXT,
  "requirement_id" TEXT,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "remarks" TEXT,
  "file_reference" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tracker_activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_tracker_projects_tracking_id_key" ON "company_tracker_projects"("tracking_id");
CREATE INDEX IF NOT EXISTS "company_tracker_projects_company_id_idx" ON "company_tracker_projects"("company_id");
CREATE INDEX IF NOT EXISTS "company_tracker_projects_owner_id_idx" ON "company_tracker_projects"("owner_id");
CREATE INDEX IF NOT EXISTS "company_tracker_projects_current_stage_idx" ON "company_tracker_projects"("current_stage");
CREATE INDEX IF NOT EXISTS "company_tracker_projects_priority_idx" ON "company_tracker_projects"("priority");
CREATE INDEX IF NOT EXISTS "company_tracker_projects_next_follow_up_date_idx" ON "company_tracker_projects"("next_follow_up_date");
CREATE UNIQUE INDEX IF NOT EXISTS "company_tracker_assignments_project_id_employee_id_key" ON "company_tracker_assignments"("project_id", "employee_id");
CREATE INDEX IF NOT EXISTS "company_tracker_assignments_employee_id_idx" ON "company_tracker_assignments"("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "project_requirements_requirement_code_key" ON "project_requirements"("requirement_code");
CREATE INDEX IF NOT EXISTS "project_requirements_tracker_project_id_idx" ON "project_requirements"("tracker_project_id");
CREATE INDEX IF NOT EXISTS "project_requirements_assigned_to_idx" ON "project_requirements"("assigned_to");
CREATE INDEX IF NOT EXISTS "project_requirements_status_idx" ON "project_requirements"("status");
CREATE INDEX IF NOT EXISTS "project_requirements_due_date_idx" ON "project_requirements"("due_date");
CREATE INDEX IF NOT EXISTS "tracker_follow_ups_next_follow_up_date_status_idx" ON "tracker_follow_ups"("next_follow_up_date", "status");
CREATE INDEX IF NOT EXISTS "tracker_follow_ups_responsible_id_idx" ON "tracker_follow_ups"("responsible_id");
CREATE INDEX IF NOT EXISTS "tracker_documents_company_id_idx" ON "tracker_documents"("company_id");
CREATE INDEX IF NOT EXISTS "tracker_documents_requirement_id_idx" ON "tracker_documents"("requirement_id");
CREATE INDEX IF NOT EXISTS "tracker_activity_logs_tracker_project_id_idx" ON "tracker_activity_logs"("tracker_project_id");
CREATE INDEX IF NOT EXISTS "tracker_activity_logs_requirement_id_idx" ON "tracker_activity_logs"("requirement_id");
CREATE INDEX IF NOT EXISTS "tracker_activity_logs_actor_id_idx" ON "tracker_activity_logs"("actor_id");

ALTER TABLE "company_tracker_projects" ADD CONSTRAINT "company_tracker_projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_tracker_projects" ADD CONSTRAINT "company_tracker_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_tracker_projects" ADD CONSTRAINT "company_tracker_projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_tracker_projects" ADD CONSTRAINT "company_tracker_projects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_tracker_projects" ADD CONSTRAINT "company_tracker_projects_source_company_project_id_fkey" FOREIGN KEY ("source_company_project_id") REFERENCES "company_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_tracker_assignments" ADD CONSTRAINT "company_tracker_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "company_tracker_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_tracker_assignments" ADD CONSTRAINT "company_tracker_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_tracker_project_id_fkey" FOREIGN KEY ("tracker_project_id") REFERENCES "company_tracker_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_company_project_id_fkey" FOREIGN KEY ("company_project_id") REFERENCES "company_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tracker_follow_ups" ADD CONSTRAINT "tracker_follow_ups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_follow_ups" ADD CONSTRAINT "tracker_follow_ups_tracker_project_id_fkey" FOREIGN KEY ("tracker_project_id") REFERENCES "company_tracker_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_follow_ups" ADD CONSTRAINT "tracker_follow_ups_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "project_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_follow_ups" ADD CONSTRAINT "tracker_follow_ups_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tracker_documents" ADD CONSTRAINT "tracker_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_documents" ADD CONSTRAINT "tracker_documents_tracker_project_id_fkey" FOREIGN KEY ("tracker_project_id") REFERENCES "company_tracker_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_documents" ADD CONSTRAINT "tracker_documents_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "project_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_documents" ADD CONSTRAINT "tracker_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tracker_activity_logs" ADD CONSTRAINT "tracker_activity_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_activity_logs" ADD CONSTRAINT "tracker_activity_logs_tracker_project_id_fkey" FOREIGN KEY ("tracker_project_id") REFERENCES "company_tracker_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_activity_logs" ADD CONSTRAINT "tracker_activity_logs_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "project_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracker_activity_logs" ADD CONSTRAINT "tracker_activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE
  admin_id TEXT;
  chandni_id TEXT;
  vemed_id TEXT;
  romano_id TEXT;
  unimark_id TEXT;
  almon_id TEXT;
  tracker_project_id_var TEXT;
BEGIN
  SELECT id INTO admin_id FROM employees WHERE role IN ('SUPER_ADMIN', 'ADMIN') ORDER BY CASE WHEN role = 'SUPER_ADMIN' THEN 0 ELSE 1 END, created_at LIMIT 1;
  SELECT id INTO chandni_id FROM employees WHERE lower(email) LIKE '%chandni%' OR lower(first_name) = 'chandni' LIMIT 1;
  chandni_id := COALESCE(chandni_id, admin_id);

  IF admin_id IS NOT NULL THEN
    SELECT id INTO vemed_id FROM client_companies WHERE name = 'Vemed Pharma' LIMIT 1;
    IF vemed_id IS NULL THEN
      vemed_id := gen_random_uuid()::text;
      INSERT INTO client_companies (id, name, industry, business_status, criticality, current_stage, responsible_employee_id, notes, created_by, risk_score, created_at, updated_at)
      VALUES (vemed_id, 'Vemed Pharma', 'Pharma', 'ACTIVE', 'MEDIUM', 'WHO-GMP Readiness', chandni_id, 'WHO audit agenda and document completion tracker. Chandni leads documentation follow-up.', admin_id, 0, NOW(), NOW());
    END IF;
    INSERT INTO company_tracker_projects (id, tracking_id, company_id, client_type, project_type, regulatory_goal, current_stage, priority, owner_id, start_date, target_completion_date, current_status_summary, next_follow_up_date, created_by, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'TRK-VEMED-WHO-001', vemed_id, 'Formulation Manufacturer', 'WHO-GMP Readiness', 'WHO', 'In Progress', 'High', chandni_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '21 days', 'WHO audit agenda and document completion tracker. Chandni leads documentation follow-up.', CURRENT_DATE + INTERVAL '1 day', admin_id, NOW(), NOW())
    ON CONFLICT (tracking_id) DO UPDATE SET company_id = EXCLUDED.company_id, updated_at = NOW()
    RETURNING id INTO tracker_project_id_var;
    INSERT INTO company_tracker_assignments (id, project_id, employee_id, role, created_at) VALUES (gen_random_uuid()::text, tracker_project_id_var, chandni_id, 'Documentation Follow-up Lead', NOW()) ON CONFLICT (project_id, employee_id) DO NOTHING;
    INSERT INTO project_requirements (id, requirement_code, tracker_project_id, category, description, expected_output, assigned_to, due_date, status, completion_percent, document_required, remarks, last_updated_by, created_at, last_updated_at) VALUES
      (gen_random_uuid()::text, 'TRK-VEMED-WHO-001-AUDIT-AGENDA', tracker_project_id_var, 'Audit Agenda', 'Prepare WHO audit agenda', 'Final audit agenda ready for client circulation', chandni_id, CURRENT_DATE + INTERVAL '7 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW()),
      (gen_random_uuid()::text, 'TRK-VEMED-WHO-001-BASIC-DOCS', tracker_project_id_var, 'Basic Documents', 'Track completed and pending WHO documents', 'Completion/pending document register', chandni_id, CURRENT_DATE + INTERVAL '10 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW()),
      (gen_random_uuid()::text, 'TRK-VEMED-WHO-001-FOLLOW-UP', tracker_project_id_var, 'Follow-up Document', 'Team follow-up for pending inputs', 'Daily follow-up closure notes', chandni_id, CURRENT_DATE + INTERVAL '3 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW())
    ON CONFLICT (requirement_code) DO NOTHING;

    SELECT id INTO romano_id FROM client_companies WHERE name = 'Romano Drugs' LIMIT 1;
    IF romano_id IS NULL THEN
      romano_id := gen_random_uuid()::text;
      INSERT INTO client_companies (id, name, industry, business_status, criticality, current_stage, responsible_employee_id, notes, created_by, risk_score, created_at, updated_at)
      VALUES (romano_id, 'Romano Drugs', 'Pharma', 'ACTIVE', 'MEDIUM', 'SOP Implementation', admin_id, 'SOP implementation, qualification documents, and validation documents assigned to A.A.', admin_id, 0, NOW(), NOW());
    END IF;
    INSERT INTO company_tracker_projects (id, tracking_id, company_id, client_type, project_type, regulatory_goal, current_stage, priority, owner_id, start_date, target_completion_date, current_status_summary, next_follow_up_date, created_by, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'TRK-ROMANO-SOP-001', romano_id, 'API Manufacturer', 'SOP Implementation', 'Internal Readiness', 'In Progress', 'High', admin_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '21 days', 'SOP implementation of all systems with qualification and validation document review assigned to A.A.', CURRENT_DATE + INTERVAL '2 days', admin_id, NOW(), NOW())
    ON CONFLICT (tracking_id) DO UPDATE SET company_id = EXCLUDED.company_id, updated_at = NOW()
    RETURNING id INTO tracker_project_id_var;
    INSERT INTO company_tracker_assignments (id, project_id, employee_id, role, created_at) VALUES (gen_random_uuid()::text, tracker_project_id_var, admin_id, 'Reviewer A.A.', NOW()) ON CONFLICT (project_id, employee_id) DO NOTHING;
    INSERT INTO project_requirements (id, requirement_code, tracker_project_id, category, description, expected_output, assigned_to, due_date, status, completion_percent, document_required, remarks, last_updated_by, created_at, last_updated_at) VALUES
      (gen_random_uuid()::text, 'TRK-ROMANO-SOP-001-SOP', tracker_project_id_var, 'SOP', 'Review SOP implementation documents across systems', 'Reviewed SOP set with comments', admin_id, CURRENT_DATE + INTERVAL '12 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW()),
      (gen_random_uuid()::text, 'TRK-ROMANO-SOP-001-QUALIFICATION', tracker_project_id_var, 'Qualification Document', 'Review qualification documents', 'Qualification review tracker', admin_id, CURRENT_DATE + INTERVAL '14 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW()),
      (gen_random_uuid()::text, 'TRK-ROMANO-SOP-001-VALIDATION', tracker_project_id_var, 'Validation Document', 'Review validation documents', 'Validation review tracker', admin_id, CURRENT_DATE + INTERVAL '16 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW())
    ON CONFLICT (requirement_code) DO NOTHING;

    SELECT id INTO unimark_id FROM client_companies WHERE name = 'Unimark Remedies' LIMIT 1;
    IF unimark_id IS NULL THEN
      unimark_id := gen_random_uuid()::text;
      INSERT INTO client_companies (id, name, industry, business_status, criticality, current_stage, responsible_employee_id, notes, created_by, risk_score, created_at, updated_at)
      VALUES (unimark_id, 'Unimark Remedies', 'Pharma', 'ACTIVE', 'HIGH', 'EDQM Compliance', admin_id, 'EDQM inspection readiness tracker.', admin_id, 0, NOW(), NOW());
    END IF;
    INSERT INTO company_tracker_projects (id, tracking_id, company_id, client_type, project_type, regulatory_goal, current_stage, priority, owner_id, start_date, target_completion_date, current_status_summary, next_follow_up_date, created_by, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'TRK-UNIMARK-EDQM-001', unimark_id, 'API Manufacturer', 'EDQM Compliance', 'EDQM', 'In Progress', 'Critical', admin_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '21 days', 'EDQM inspection readiness covering basic documents, specific documents, analytical data sheet, and BMR review.', CURRENT_DATE + INTERVAL '1 day', admin_id, NOW(), NOW())
    ON CONFLICT (tracking_id) DO UPDATE SET company_id = EXCLUDED.company_id, updated_at = NOW()
    RETURNING id INTO tracker_project_id_var;
    INSERT INTO company_tracker_assignments (id, project_id, employee_id, role, created_at) VALUES (gen_random_uuid()::text, tracker_project_id_var, admin_id, 'Project Owner', NOW()) ON CONFLICT (project_id, employee_id) DO NOTHING;
    INSERT INTO project_requirements (id, requirement_code, tracker_project_id, category, description, expected_output, assigned_to, due_date, status, completion_percent, document_required, remarks, last_updated_by, created_at, last_updated_at) VALUES
      (gen_random_uuid()::text, 'TRK-UNIMARK-EDQM-001-BASIC', tracker_project_id_var, 'Basic Documents', 'Collect and review EDQM basic documents', 'Basic document readiness pack', admin_id, CURRENT_DATE + INTERVAL '5 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW()),
      (gen_random_uuid()::text, 'TRK-UNIMARK-EDQM-001-ADS', tracker_project_id_var, 'Analytical Data Sheet', 'Review analytical data sheets', 'Analytical review comments', admin_id, CURRENT_DATE + INTERVAL '9 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW()),
      (gen_random_uuid()::text, 'TRK-UNIMARK-EDQM-001-BMR', tracker_project_id_var, 'BMR Review', 'Review BMR documents for EDQM readiness', 'BMR gap/comment log', admin_id, CURRENT_DATE + INTERVAL '11 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW())
    ON CONFLICT (requirement_code) DO NOTHING;

    SELECT id INTO almon_id FROM client_companies WHERE name = 'Almon Lifesciences' LIMIT 1;
    IF almon_id IS NULL THEN
      almon_id := gen_random_uuid()::text;
      INSERT INTO client_companies (id, name, industry, business_status, criticality, current_stage, responsible_employee_id, notes, created_by, risk_score, created_at, updated_at)
      VALUES (almon_id, 'Almon Lifesciences', 'Pharma', 'ACTIVE', 'HIGH', 'USFDA Readiness', admin_id, 'USFDA gap assessment with audit agenda tracking.', admin_id, 0, NOW(), NOW());
    END IF;
    INSERT INTO company_tracker_projects (id, tracking_id, company_id, client_type, project_type, regulatory_goal, current_stage, priority, owner_id, start_date, target_completion_date, current_status_summary, next_follow_up_date, created_by, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'TRK-ALMON-USFDA-001', almon_id, 'Audit Client', 'USFDA Readiness', 'USFDA', 'In Progress', 'Critical', admin_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '21 days', 'USFDA gap assessment with audit agenda and gap assessment tracking.', CURRENT_DATE + INTERVAL '1 day', admin_id, NOW(), NOW())
    ON CONFLICT (tracking_id) DO UPDATE SET company_id = EXCLUDED.company_id, updated_at = NOW()
    RETURNING id INTO tracker_project_id_var;
    INSERT INTO company_tracker_assignments (id, project_id, employee_id, role, created_at) VALUES (gen_random_uuid()::text, tracker_project_id_var, admin_id, 'Project Owner', NOW()) ON CONFLICT (project_id, employee_id) DO NOTHING;
    INSERT INTO project_requirements (id, requirement_code, tracker_project_id, category, description, expected_output, assigned_to, due_date, status, completion_percent, document_required, remarks, last_updated_by, created_at, last_updated_at) VALUES
      (gen_random_uuid()::text, 'TRK-ALMON-USFDA-001-AUDIT', tracker_project_id_var, 'Audit Agenda', 'Prepare USFDA audit agenda', 'USFDA audit agenda draft', admin_id, CURRENT_DATE + INTERVAL '6 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW()),
      (gen_random_uuid()::text, 'TRK-ALMON-USFDA-001-GAP', tracker_project_id_var, 'Gap Assessment', 'Track USFDA gap assessment observations', 'Gap assessment tracker with CAPA ownership', admin_id, CURRENT_DATE + INTERVAL '13 days', 'In Progress', 25, true, 'Seeded editable tracker requirement', admin_id, NOW(), NOW())
    ON CONFLICT (requirement_code) DO NOTHING;
  END IF;
END $$;
