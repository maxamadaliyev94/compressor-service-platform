CREATE TABLE "equipment_photos" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_photos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "equipment_photos"
ADD CONSTRAINT "equipment_photos_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "equipment_photos_equipmentId_idx" ON "equipment_photos"("equipmentId");
