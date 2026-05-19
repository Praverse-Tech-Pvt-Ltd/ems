-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "face_enrolled_at" TIMESTAMPTZ,
ADD COLUMN     "face_model" TEXT,
ADD COLUMN     "face_vector" vector(128);

