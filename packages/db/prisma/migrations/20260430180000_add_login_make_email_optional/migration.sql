ALTER TABLE "users" ADD COLUMN "login" TEXT;

UPDATE "users"
SET "login" = CASE
  WHEN "email" IS NOT NULL AND POSITION('@' IN "email") > 1 THEN SPLIT_PART("email", '@', 1)
  WHEN "email" IS NOT NULL THEN "email"
  ELSE 'user_' || SUBSTRING("id" FROM 1 FOR 8)
END
WHERE "login" IS NULL;

UPDATE "users" u
SET "login" = u."login" || '_' || SUBSTRING(u."id" FROM 1 FOR 4)
WHERE EXISTS (
  SELECT 1
  FROM "users" x
  WHERE x."id" <> u."id" AND x."login" = u."login"
);

ALTER TABLE "users" ALTER COLUMN "login" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_login_key" UNIQUE ("login");
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
