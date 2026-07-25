-- Per-employee shift timing, replacing the hardcoded first-name matching
-- previously used in the attendance service. Null means "use the
-- company-default shift" (09:30-18:00).
ALTER TABLE "employees" ADD COLUMN "shift_start_minutes" INTEGER;
ALTER TABLE "employees" ADD COLUMN "shift_end_minutes" INTEGER;

-- Backfill the two shift groups that were previously hardcoded by
-- first name, so behavior is unchanged for currently-configured employees.
UPDATE "employees"
SET "shift_start_minutes" = 540, "shift_end_minutes" = 1050 -- 09:00-17:30
WHERE lower("first_name") IN ('shifa', 'chandni', 'dilip');

UPDATE "employees"
SET "shift_start_minutes" = 600, "shift_end_minutes" = 1110 -- 10:00-18:30
WHERE lower("first_name") IN ('maanav', 'dev');
