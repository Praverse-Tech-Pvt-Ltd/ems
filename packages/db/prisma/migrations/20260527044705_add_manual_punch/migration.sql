-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "is_manual_punch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manual_punch_reason" TEXT;
