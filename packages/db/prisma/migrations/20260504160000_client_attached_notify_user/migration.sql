ALTER TABLE "clients" ADD COLUMN "attachedNotifyUserId" TEXT;

CREATE INDEX "clients_attachedNotifyUserId_idx" ON "clients"("attachedNotifyUserId");

ALTER TABLE "clients" ADD CONSTRAINT "clients_attachedNotifyUserId_fkey" FOREIGN KEY ("attachedNotifyUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
