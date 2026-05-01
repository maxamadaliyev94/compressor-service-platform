-- Add soft-delete fields for task trash
ALTER TABLE "service_tasks"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletedStatus" "TaskStatus";

ALTER TABLE "service_tasks"
ADD CONSTRAINT "service_tasks_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "service_tasks_deletedAt_idx" ON "service_tasks"("deletedAt");
