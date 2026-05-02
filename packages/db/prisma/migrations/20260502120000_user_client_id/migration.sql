ALTER TABLE "users" ADD COLUMN "clientId" TEXT;

CREATE INDEX "users_clientId_idx" ON "users"("clientId");

ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
