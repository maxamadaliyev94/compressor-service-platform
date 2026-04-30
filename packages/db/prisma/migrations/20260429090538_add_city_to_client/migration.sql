-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'Узбекистан';
