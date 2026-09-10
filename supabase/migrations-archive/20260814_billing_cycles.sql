-- Billing cycles for advertisements (banner adverts) and service_ads (business ads/services),
-- plus a billing notification log used by the Admin → Billing tab.

ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS billing_start timestamptz,
  ADD COLUMN IF NOT EXISTS billing_end timestamptz,
  ADD COLUMN IF NOT EXISTS last_invoice_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_email text;

ALTER TABLE public.service_ads
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS billing_start timestamptz,
  ADD COLUMN IF NOT EXISTS billing_end timestamptz,
  ADD COLUMN IF NOT EXISTS last_invoice_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_email text;

-- Banner adverts renew weekly (KES 100/week; KES 500/week featured boost).
-- Affiliate/partnership banners are not billed.
UPDATE public.advertisements SET
  billing_cycle = COALESCE(billing_cycle, '7 days'),
  billing_start = COALESCE(billing_start, created_at, now()),
  billing_end   = COALESCE(billing_end, COALESCE(created_at, now()) + interval '7 days')
WHERE is_affiliate = false;

-- Business ads follow their plan (10/20/30 days). billing_end mirrors expiry_date.
UPDATE public.service_ads SET
  billing_cycle = COALESCE(billing_cycle,
    CASE plan
      WHEN '10-day' THEN '10 days'
      WHEN '20-day' THEN '20 days'
      WHEN '30-day' THEN '30 days'
      ELSE '30 days'
    END),
  billing_start = COALESCE(billing_start, created_at, now()),
  billing_end   = COALESCE(billing_end, expiry_date::timestamptz);

-- Billing notification log (invoice / renewal alert emails sent to advertisers)
CREATE TABLE IF NOT EXISTS public.billing_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,            -- 'advert' | 'service_ad'
  item_id uuid NOT NULL,
  business_name text,
  recipient_email text NOT NULL,
  subject text,
  amount numeric,
  due_date date,
  status text DEFAULT 'sent',
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.billing_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read billing_notifications" ON public.billing_notifications;
CREATE POLICY "public read billing_notifications" ON public.billing_notifications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins write billing_notifications" ON public.billing_notifications;
CREATE POLICY "admins write billing_notifications" ON public.billing_notifications
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

GRANT SELECT ON TABLE public.billing_notifications TO anon, authenticated;
