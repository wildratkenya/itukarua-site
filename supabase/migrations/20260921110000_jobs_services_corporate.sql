-- Corporate linkage for jobs and service ads.
-- Adds corporate_account_id (FK → corporate_accounts) and corporate_tier to both
-- jobs and service_ads so admin can label a job/service post as belonging to a
-- corporate account and surface a badge site-wide. Linkage is optional and
-- admin-driven (Manage Corporate Account panel).

-- jobs -----------------------------------------------------------------

ALTER TABLE "public"."jobs"
  ADD COLUMN IF NOT EXISTS "corporate_account_id" uuid,
  ADD COLUMN IF NOT EXISTS "corporate_tier" text;

ALTER TABLE "public"."service_ads"
  ADD COLUMN IF NOT EXISTS "corporate_account_id" uuid,
  ADD COLUMN IF NOT EXISTS "corporate_tier" text;

-- FKs (idempotent, safe if columns already existed from a previous attempt)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobs'::regclass AND conname = 'jobs_corporate_account_id_fkey'
  ) THEN
    ALTER TABLE "public"."jobs"
      ADD CONSTRAINT "jobs_corporate_account_id_fkey"
      FOREIGN KEY ("corporate_account_id")
      REFERENCES "public"."corporate_accounts"("id")
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_ads'::regclass AND conname = 'service_ads_corporate_account_id_fkey'
  ) THEN
    ALTER TABLE "public"."service_ads"
      ADD CONSTRAINT "service_ads_corporate_account_id_fkey"
      FOREIGN KEY ("corporate_account_id")
      REFERENCES "public"."corporate_accounts"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for lookups by corporate account
CREATE INDEX IF NOT EXISTS "jobs_corporate_account_id_idx"
  ON "public"."jobs" ("corporate_account_id");

CREATE INDEX IF NOT EXISTS "service_ads_corporate_account_id_idx"
  ON "public"."service_ads" ("corporate_account_id");