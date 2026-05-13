-- CreateEnum
CREATE TYPE "TaskParticipantStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "long_term_task_engineers" ADD COLUMN "participation_status" "TaskParticipantStatus" NOT NULL DEFAULT 'ASSIGNED';

-- AlterTable
ALTER TABLE "work_reports" ADD COLUMN "participant_engineer_ids" JSONB;
