-- Job ads get a serving window driven by the paid employer plan, plus a
-- retirement lifecycle (employer or system). Access/application deadlines stay
-- on jobs.deadline; valid_until is the ad's paid listing window.
--
--   serving        : status='open' AND valid_until >= now() AND retired_at IS NULL
--   application    : deadline < today and still serving -> "Application closed"
--   disabled       : valid_until < now() (or NULL = never published)
--   retired         : retired_by in ('employer','system'), removed from frontend

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS valid_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS retired_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS retired_by text;

-- Grandfather legacy rows: 30 days from posting until a plan governs them.
UPDATE public.jobs
SET valid_until = COALESCE(created_at, now()) + interval '30 days'
WHERE valid_until IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_retired_by_valid'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_retired_by_valid CHECK (retired_by IS NULL OR retired_by IN ('employer', 'system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS jobs_serving_idx
  ON public.jobs (status, valid_until)
  WHERE retired_at IS NULL;

-- Only count jobs that actually serve on the public site.
CREATE OR REPLACE VIEW "public"."platform_stats" AS
 SELECT ( SELECT "count"(*) AS "count"
            FROM "public"."jobs"
           WHERE ("jobs"."status" = 'open'::"text"
                  AND "jobs"."valid_until" >= now()
                  AND "jobs"."retired_at" IS NULL)) AS "active_jobs",
    ( SELECT "count"(*) AS "count"
           FROM "public"."profiles"
          WHERE (("profiles"."role" = 'jobseeker'::"text") AND ("profiles"."verified" = true))) AS "registered_workers",
    ( SELECT "count"(*) AS "count"
           FROM "public"."service_ads"
          WHERE ("service_ads"."expiry_date" >= CURRENT_DATE)) AS "active_businesses",
    ( SELECT "count"(*) AS "count"
           FROM "public"."jobs"
          WHERE ("jobs"."status" = 'completed'::"text")) AS "completed_jobs",
    ( SELECT COALESCE("sum"("payments"."amount"), (0)::numeric) AS "coalesce"
           FROM "public"."payments"
          WHERE ("payments"."status" = 'completed'::"text")) AS "total_payments",
    ( SELECT "count"(DISTINCT "profiles"."location") AS "count"
           FROM "public"."profiles"
          WHERE (("profiles"."location" IS NOT NULL) AND ("profiles"."location" <> ''::"text"))) AS "counties_served";
