-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER', 'CLIENT');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'POTENTIAL', 'SERVICE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('COMPRESSOR', 'DRYER', 'RECEIVER', 'FILTER', 'NITROGEN_GENERATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('WORKING', 'STOPPED', 'REPAIR', 'PRESERVED', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "WarrantyVoidReason" AS ENUM ('LATE_MAINTENANCE', 'NON_ORIGINAL_PARTS', 'SELF_REPAIR', 'POOR_VENTILATION', 'OVERHEATING', 'VOLTAGE_SURGE', 'DIRTY_RADIATOR', 'OPERATION_VIOLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('PLANNED_MAINTENANCE', 'DIAGNOSTICS', 'WARRANTY_REPAIR', 'EMERGENCY', 'INSTALLATION', 'COMMISSIONING');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVIEW', 'DONE', 'REVISION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('BEFORE', 'AFTER', 'NAMEPLATE', 'PROBLEM_AREA', 'OTHER');

-- CreateEnum
CREATE TYPE "ChecklistItemType" AS ENUM ('CONTROL', 'WORK', 'PART');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ENGINEER',
    "phone" TEXT,
    "telegramId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contactPerson" TEXT,
    "workingHours" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objects" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contactPerson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "yearOfManufacture" INTEGER,
    "saleDate" TIMESTAMP(3),
    "installDate" TIMESTAMP(3),
    "warrantyUntil" TIMESTAMP(3),
    "warrantyVoided" BOOLEAN NOT NULL DEFAULT false,
    "warrantyVoidReason" "WarrantyVoidReason",
    "currentHours" INTEGER NOT NULL DEFAULT 0,
    "lastServiceHours" INTEGER,
    "lastServiceDate" TIMESTAMP(3),
    "nextServiceHours" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "status" "EquipmentStatus" NOT NULL DEFAULT 'WORKING',
    "qrCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_tasks" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'NEW',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "comment" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_reports" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "currentHours" INTEGER NOT NULL,
    "pressure" DOUBLE PRECISION,
    "oilTemp" DOUBLE PRECISION,
    "airTemp" DOUBLE PRECISION,
    "roomCondition" TEXT,
    "notes" TEXT,
    "recommendations" TEXT,
    "nextServiceHours" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "clientSignature" TEXT,
    "engineerSignature" TEXT,
    "pdfUrl" TEXT,
    "actNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "itemType" "ChecklistItemType" NOT NULL DEFAULT 'CONTROL',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts_used" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "article" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "parts_used_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL DEFAULT 'OTHER',
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_regulations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentType" "EquipmentType" NOT NULL,
    "intervalHours" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_regulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_serialNumber_key" ON "equipment"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_qrCode_key" ON "equipment"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "work_reports_taskId_key" ON "work_reports"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "work_reports_actNumber_key" ON "work_reports"("actNumber");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objects" ADD CONSTRAINT "objects_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "service_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "work_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_used" ADD CONSTRAINT "parts_used_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "work_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "work_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
