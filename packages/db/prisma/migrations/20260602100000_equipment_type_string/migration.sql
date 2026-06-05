-- Тип оборудования: enum → код из справочника equipment_type_refs
ALTER TABLE "equipment" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
ALTER TABLE "maintenance_regulations" ALTER COLUMN "equipmentType" TYPE TEXT USING "equipmentType"::text;
