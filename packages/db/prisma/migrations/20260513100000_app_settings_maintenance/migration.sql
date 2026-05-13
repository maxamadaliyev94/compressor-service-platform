-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "maintenanceStart" TIMESTAMP(3),
ADD COLUMN "maintenanceEnd" TIMESTAMP(3),
ADD COLUMN "maintenanceMessage" TEXT;
