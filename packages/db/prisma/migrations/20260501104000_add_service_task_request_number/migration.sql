ALTER TABLE "service_tasks"
ADD COLUMN "requestNumber" INTEGER;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "service_tasks"
)
UPDATE "service_tasks" st
SET "requestNumber" = numbered.rn
FROM numbered
WHERE st."id" = numbered."id";

ALTER TABLE "service_tasks"
ALTER COLUMN "requestNumber" SET NOT NULL;

CREATE INDEX "service_tasks_requestNumber_idx" ON "service_tasks"("requestNumber");
