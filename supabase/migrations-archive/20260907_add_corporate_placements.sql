-- Corporate placements: tier tagging for corporate/admin-created placements,
-- and an advert_leads inbox for the /advertise quote form.

-- Tag corporate placements (bronze | silver | gold | custom).
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS corporate_tier text;
COMMENT ON COLUMN public.advertisements.corporate_tier IS 'bronze|silver|gold|custom — set for corporate/admin-created placements';

-- Organisation quote requests from the /advertise lead form.
CREATE TABLE IF NOT EXISTS public.advert_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  package text NOT NULL DEFAULT 'bronze',
  start_date date,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advert_leads ENABLE ROW LEVEL SECURITY;

-- Anyone on the site can submit a quote request.
DROP POLICY IF EXISTS "public insert advert_leads" ON public.advert_leads;
CREATE POLICY "public insert advert_leads" ON public.advert_leads
  FOR INSERT WITH CHECK (true);

-- Only super admins can read, update or delete leads.
DROP POLICY IF EXISTS "super_admin manage advert_leads" ON public.advert_leads;
CREATE POLICY "super_admin manage advert_leads" ON public.advert_leads
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_advert_leads_status ON public.advert_leads(status, created_at);