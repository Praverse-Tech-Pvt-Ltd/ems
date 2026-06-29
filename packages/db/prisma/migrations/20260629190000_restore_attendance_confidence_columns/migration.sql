ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "fr_confidence_in" DECIMAL(4,3),
  ADD COLUMN IF NOT EXISTS "fr_confidence_out" DECIMAL(4,3);
