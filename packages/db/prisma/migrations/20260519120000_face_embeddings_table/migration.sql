-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Face embeddings table for 128-d dlib face encodings
CREATE TABLE IF NOT EXISTS "face_embeddings" (
    "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "employee_id" TEXT         NOT NULL,
    "embedding"   vector(128)  NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_embeddings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "face_embeddings_employee_id_key" UNIQUE ("employee_id"),
    CONSTRAINT "face_embeddings_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE
);

-- IVFFlat cosine similarity index for fast 1:N nearest-neighbour search
CREATE INDEX IF NOT EXISTS "face_embeddings_embedding_idx"
    ON "face_embeddings" USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);
