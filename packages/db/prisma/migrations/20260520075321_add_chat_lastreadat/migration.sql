-- DropForeignKey
ALTER TABLE "face_embeddings" DROP CONSTRAINT "face_embeddings_employee_id_fkey";

-- DropIndex
DROP INDEX "face_embeddings_embedding_idx";

-- AlterTable
ALTER TABLE "chat_channel_members" ADD COLUMN     "last_read_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "face_embeddings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
