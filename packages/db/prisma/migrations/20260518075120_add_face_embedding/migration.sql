-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "face_embedding" JSONB;

-- AlterTable
ALTER TABLE "salary_slips" ALTER COLUMN "updated_at" DROP DEFAULT;
