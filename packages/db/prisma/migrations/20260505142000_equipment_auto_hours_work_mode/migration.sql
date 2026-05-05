-- Add work-mode settings used for automatic hourly moto-hours updates
ALTER TABLE "equipment"
ADD COLUMN "hours_per_day" DOUBLE PRECISION,
ADD COLUMN "days_per_week" DOUBLE PRECISION;

-- Allow fractional moto-hours increments each hour
ALTER TABLE "equipment"
ALTER COLUMN "currentHours" TYPE DOUBLE PRECISION
USING "currentHours"::DOUBLE PRECISION;
