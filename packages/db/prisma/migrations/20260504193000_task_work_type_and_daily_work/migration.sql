-- CreateEnum
CREATE TYPE "TaskWorkType" AS ENUM ('QUICK', 'LONG_TERM');

-- AlterTable
ALTER TABLE "service_tasks" ADD COLUMN "task_type" "TaskWorkType" NOT NULL DEFAULT 'QUICK';

ALTER TABLE "service_tasks" ADD COLUMN "managedByChiefId" TEXT;

ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_managedByChiefId_fkey" FOREIGN KEY ("managedByChiefId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "daily_work" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "checklist" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_work_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_work_taskId_engineerId_date_key" ON "daily_work"("taskId", "engineerId", "date");

CREATE INDEX "daily_work_taskId_idx" ON "daily_work"("taskId");

ALTER TABLE "daily_work" ADD CONSTRAINT "daily_work_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "service_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_work" ADD CONSTRAINT "daily_work_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
