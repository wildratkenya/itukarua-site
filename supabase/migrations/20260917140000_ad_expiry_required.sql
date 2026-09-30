-- Expiry is required on every advert: no "no expiry" ads on the site.
-- Backfill legacy rows first, then lock the window down with NOT NULL + CHECK.

-- Helper: map billing_cycle to days (10/20/30, default 30).
UPDATE public.advertisements
SET billing_start = COALESCE(billing_start, created_at, now()),
    billing_end = COALESCE(
      billing_end,
      created_at + interval '1 day' * CASE
        WHEN billing_cycle = '10 days' THEN 10
        WHEN billing_cycle = '20 days' THEN 20
        WHEN billing_cycle = '30 days' THEN 30
        ELSE 30
      END,
      now() + interval '30 days'
    )
WHERE billing_start IS NULL OR billing_end IS NULL;

-- Coerce any inverted window (billing_end <= billing_start).
UPDATE public.advertisements
SET billing_end = billing_start + interval '1 day' * CASE
      WHEN billing_cycle = '10 days' THEN 10
      WHEN billing_cycle = '20 days' THEN 20
      WHEN billing_cycle = '30 days' THEN 30
      ELSE 10
    END
WHERE billing_end IS NOT NULL AND billing_start IS NOT NULL AND billing_end <= billing_start;

ALTER TABLE public.advertisements
  ALTER COLUMN billing_start SET NOT NULL,
  ALTER COLUMN billing_end SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.advertisements'::regclass
      AND conname = 'advertisements_billing_window'
  ) THEN
    ALTER TABLE public.advertisements
      ADD CONSTRAINT advertisements_billing_window CHECK (billing_end > billing_start);
  END IF;
END $$;