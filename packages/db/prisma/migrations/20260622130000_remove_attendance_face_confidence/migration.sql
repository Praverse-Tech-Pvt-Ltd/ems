DROP TABLE IF EXISTS "face_embeddings";

ALTER TABLE "employees"
  DROP COLUMN IF EXISTS "face_enrolled",
  DROP COLUMN IF EXISTS "face_vector_s3_key",
  DROP COLUMN IF EXISTS "face_embedding",
  DROP COLUMN IF EXISTS "face_enrolled_at",
  DROP COLUMN IF EXISTS "face_model",
  DROP COLUMN IF EXISTS "face_vector";

ALTER TABLE "attendance_records"
  DROP COLUMN IF EXISTS "fr_confidence_in",
  DROP COLUMN IF EXISTS "fr_confidence_out";
