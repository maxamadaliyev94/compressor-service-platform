-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_settings" ("id", "isActive", "updatedAt") VALUES ('default', true, CURRENT_TIMESTAMP);
