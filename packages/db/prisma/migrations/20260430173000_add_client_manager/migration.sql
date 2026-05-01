ALTER TABLE "clients"
ADD COLUMN "managerId" TEXT;

ALTER TABLE "clients"
ADD CONSTRAINT "clients_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "clients_managerId_idx" ON "clients"("managerId");
