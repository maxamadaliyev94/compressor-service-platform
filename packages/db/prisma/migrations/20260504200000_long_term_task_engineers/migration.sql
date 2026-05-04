-- CreateTable
CREATE TABLE "long_term_task_engineers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "long_term_task_engineers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "long_term_task_engineers_taskId_engineerId_key" ON "long_term_task_engineers"("taskId", "engineerId");

CREATE INDEX "long_term_task_engineers_taskId_idx" ON "long_term_task_engineers"("taskId");

ALTER TABLE "long_term_task_engineers" ADD CONSTRAINT "long_term_task_engineers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "service_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "long_term_task_engineers" ADD CONSTRAINT "long_term_task_engineers_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
