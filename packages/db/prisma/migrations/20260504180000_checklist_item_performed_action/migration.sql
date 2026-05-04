-- CreateEnum
CREATE TYPE "ChecklistItemAction" AS ENUM ('REPLACE', 'TOP_UP', 'REPAIR');

-- AlterTable
ALTER TABLE "checklist_items" ADD COLUMN "performedAction" "ChecklistItemAction";
