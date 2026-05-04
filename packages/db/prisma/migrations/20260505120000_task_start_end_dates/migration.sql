-- AlterTable
ALTER TABLE "service_tasks" ADD COLUMN "start_date" DATE,
ADD COLUMN "end_date" DATE;

UPDATE "service_tasks"
SET "start_date" = ("createdAt" AT TIME ZONE 'UTC')::date
WHERE "task_type" = 'LONG_TERM' AND "start_date" IS NULL;

UPDATE "service_tasks"
SET "end_date" = ("scheduledAt" AT TIME ZONE 'UTC')::date
WHERE "task_type" = 'LONG_TERM' AND "scheduledAt" IS NOT NULL AND "end_date" IS NULL;
