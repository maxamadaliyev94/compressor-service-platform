-- Тип работы задачи: enum → текст (код из справочника work_type_refs)
ALTER TABLE "service_tasks" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
