-- CreateTable
CREATE TABLE "work_type_refs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_type_refs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_type_refs_code_key" ON "work_type_refs"("code");

-- Предзаполнение типов работ (совпадает с enum TaskType)
INSERT INTO "work_type_refs" ("id", "code", "nameRu", "isSystem", "sortOrder") VALUES
('cm_seed_wt_001', 'PLANNED_MAINTENANCE', 'Плановое ТО', true, 0),
('cm_seed_wt_002', 'DIAGNOSTICS', 'Диагностика', true, 1),
('cm_seed_wt_003', 'WARRANTY_REPAIR', 'Гарантийный ремонт', true, 2),
('cm_seed_wt_004', 'EMERGENCY', 'Аварийный выезд', true, 3),
('cm_seed_wt_005', 'INSTALLATION', 'Монтаж', true, 4),
('cm_seed_wt_006', 'COMMISSIONING', 'Пусконаладка', true, 5)
ON CONFLICT ("code") DO UPDATE SET
  "nameRu" = EXCLUDED."nameRu",
  "isSystem" = EXCLUDED."isSystem",
  "sortOrder" = EXCLUDED."sortOrder";

-- Регламенты: taskType enum → текст (код из справочника)
ALTER TABLE "maintenance_regulations" ALTER COLUMN "taskType" DROP DEFAULT;
ALTER TABLE "maintenance_regulations" ALTER COLUMN "taskType" TYPE TEXT USING "taskType"::text;
ALTER TABLE "maintenance_regulations" ALTER COLUMN "taskType" SET DEFAULT 'PLANNED_MAINTENANCE';
