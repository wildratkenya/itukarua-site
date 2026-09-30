-- Expiry is required on every site product: advertisements (done in
-- 20260917140000_ad_expiry_required.sql), service_ads, and jobs.
-- Backfill legacy rows, then lock expiry down with NOT NULL (+ window checks).

-- ─── service_ads ───────────────────────────────────────────────────────────────
UPDATE public.service_ads
SET billing_start = COALESCE(billing_start, created_at, now())
WHERE billing_start IS NULL;

UPDATE public.service_ads
SET billing_end = COALESCE(billing_end, created_at + interval '30 days', now() + interval '30 days')
WHERE billing_end IS NULL;

UPDATE public.service_ads
SET expiry_date = COALESCE(expiry_date, (billing_end)::date, (now() + interval '30 days')::date)
WHERE expiry_date IS NULL;

-- Coerce any inverted window.
UPDATE public.service_ads
SET billing_end = billing_start + interval '30 days',
    expiry_date = (billing_start + interval '30 days')::date
WHERE billing_end IS NOT NULL AND billing_start IS NOT NULL AND billing_end <= billing_start;

ALTER TABLE public.service_ads
  ALTER COLUMN billing_start SET NOT NULL,
  ALTER COLUMN billing_end SET NOT NULL,
  ALTER COLUMN expiry_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_ads'::regclass
      AND conname = 'service_ads_billing_window'
  ) THEN
    ALTER TABLE public.service_ads
      ADD CONSTRAINT service_ads_billing_window CHECK (billing_end > billing_start);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_ads'::regclass
      AND conname = 'service_ads_expiry_window'
  ) THEN
    ALTER TABLE public.service_ads
      ADD CONSTRAINT service_ads_expiry_window CHECK (expiry_date >= (billing_start)::date);
  END IF;
END $$;

-- ─── jobs ─────────────────────────────────────────────────────────────────────
UPDATE public.jobs
SET deadline = COALESCE(deadline, (created_at + interval '30 days')::date, (now() + interval '30 days')::date)
WHERE deadline IS NULL;

ALTER TABLE public.jobs
  ALTER COLUMN deadline SET NOT NULL;