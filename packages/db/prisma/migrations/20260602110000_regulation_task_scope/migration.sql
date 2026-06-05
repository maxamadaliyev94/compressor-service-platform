-- Чек-листы: отдельно для быстрых и долгосрочных задач
CREATE TYPE "RegulationTaskScope" AS ENUM ('QUICK', 'LONG_TERM');

ALTER TABLE "maintenance_regulations"
ADD COLUMN "taskScope" "RegulationTaskScope" NOT NULL DEFAULT 'QUICK';
