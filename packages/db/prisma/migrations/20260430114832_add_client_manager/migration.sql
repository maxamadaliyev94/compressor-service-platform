/*
  Warnings:

  - The values [ACTIVE,POTENTIAL,SERVICE,ARCHIVED] on the enum `ClientStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ClientStatus_new" AS ENUM ('VIP', 'STANDART', 'PASSIVE');
ALTER TABLE "clients" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "status" TYPE "ClientStatus_new" USING ("status"::text::"ClientStatus_new");
ALTER TYPE "ClientStatus" RENAME TO "ClientStatus_old";
ALTER TYPE "ClientStatus_new" RENAME TO "ClientStatus";
DROP TYPE "ClientStatus_old";
ALTER TABLE "clients" ALTER COLUMN "status" SET DEFAULT 'STANDART';
COMMIT;

-- DropIndex
DROP INDEX "clients_managerId_idx";

-- DropIndex
DROP INDEX "service_tasks_deletedAt_idx";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "comment" TEXT;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "status" SET DEFAULT 'STANDART';

-- AlterTable
ALTER TABLE "maintenance_regulations" ADD COLUMN     "taskType" "TaskType" NOT NULL DEFAULT 'PLANNED_MAINTENANCE';

-- CreateTable
CREATE TABLE "maintenance_regulation_items" (
    "id" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "itemType" "ChecklistItemType" NOT NULL DEFAULT 'CONTROL',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "maintenance_regulation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_brand_refs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_brand_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_type_refs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_type_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_brand_refs_name_key" ON "equipment_brand_refs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_type_refs_name_key" ON "equipment_type_refs"("name");

-- AddForeignKey
ALTER TABLE "maintenance_regulation_items" ADD CONSTRAINT "maintenance_regulation_items_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "maintenance_regulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
