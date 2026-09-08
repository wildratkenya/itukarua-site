-- Corporate accounts: multi-user login per company, tiered placements,
-- gated by subscription tier (bronze|silver|gold|custom).

-- 1. corporate_accounts
CREATE TABLE IF NOT EXISTS public.corporate_accounts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text        NOT NULL,
  tier         text        NOT NULL CHECK (tier IN ('bronze','silver','gold','custom')),
  is_active    boolean     DEFAULT true,
  contact_person  text,
  contact_phone   text,
  contact_email   text,
  billing_email   text,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.corporate_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin manages corporate_accounts" ON public.corporate_accounts;
CREATE POLICY "super_admin manages corporate_accounts" ON public.corporate_accounts
  FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
GRANT SELECT, INSERT, UPDATE ON public.corporate_accounts TO authenticated;

-- 2. corporate_members
CREATE TABLE IF NOT EXISTS public.corporate_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES corporate_accounts(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member' CHECK (member_role IN ('owner','member')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (account_id, profile_id)
);

ALTER TABLE public.corporate_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin manages corporate_members" ON public.corporate_members;
CREATE POLICY "super_admin manages corporate_members" ON public.corporate_members
  FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
DROP POLICY IF EXISTS "corporate members read own members" ON public.corporate_members;
CREATE POLICY "corporate members read own members" ON public.corporate_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.corporate_members cm
      WHERE cm.account_id = corporate_members.account_id
        AND cm.profile_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "corporate owners manage members" ON public.corporate_members;
CREATE POLICY "corporate owners manage members" ON public.corporate_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.corporate_members cm
      WHERE cm.account_id = corporate_members.account_id
        AND cm.profile_id = auth.uid()
        AND cm.member_role = 'owner'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.corporate_members cm
      WHERE cm.account_id = corporate_members.account_id
        AND cm.profile_id = auth.uid()
        AND cm.member_role = 'owner'
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_members TO authenticated;

-- 2b. corporate_accounts policies that depend on corporate_members (created above)
DROP POLICY IF EXISTS "corporate members read account" ON public.corporate_accounts;
CREATE POLICY "corporate members read account" ON public.corporate_accounts
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.corporate_members cm
      WHERE cm.account_id = id AND cm.profile_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "corporate owners update account" ON public.corporate_accounts;
CREATE POLICY "corporate owners update account" ON public.corporate_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.corporate_members cm
      WHERE cm.account_id = id AND cm.profile_id = auth.uid() AND cm.member_role = 'owner'
    )
  );

-- 3. advertisements.corporate_account_id
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS corporate_account_id uuid
  REFERENCES corporate_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_advertisements_corporate ON public.advertisements(corporate_account_id);
DROP POLICY IF EXISTS "corporate members manage own ads" ON public.advertisements;
CREATE POLICY "corporate members manage own ads" ON public.advertisements
  FOR UPDATE USING (
    corporate_account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.corporate_members cm
      WHERE cm.account_id = advertisements.corporate_account_id
        AND cm.profile_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "corporate members insert own ads" ON public.advertisements;
CREATE POLICY "corporate members insert own ads" ON public.advertisements
  FOR INSERT WITH CHECK (
    corporate_account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.corporate_members cm
      WHERE cm.account_id = advertisements.corporate_account_id
        AND cm.profile_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "corporate members read own ads" ON public.advertisements;
CREATE POLICY "corporate members read own ads" ON public.advertisements
  FOR SELECT USING (
    corporate_account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.corporate_members cm
      WHERE cm.account_id = advertisements.corporate_account_id
        AND cm.profile_id = auth.uid()
    )
  );

-- 4. advert_analytics: allow corporate members to read their own ads' analytics
DROP POLICY IF EXISTS "corporate read own analytics" ON public.advert_analytics;
CREATE POLICY "corporate read own analytics" ON public.advert_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.advertisements a
      JOIN public.corporate_members cm ON cm.account_id = a.corporate_account_id
      WHERE a.id = advert_analytics.ad_id
        AND cm.profile_id = auth.uid()
    )
  );

-- 5. payments: allow corporate members to see invoices for their placements
DROP POLICY IF EXISTS "corporate read own invoices" ON public.payments;
CREATE POLICY "corporate read own invoices" ON public.payments
  FOR SELECT USING (
    (related_ad_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.advertisements a
      JOIN public.corporate_members cm ON cm.account_id = a.corporate_account_id
      WHERE a.id = payments.related_ad_id::uuid
        AND cm.profile_id = auth.uid()
    ))
  );

-- 6. updated_at trigger for corporate_accounts
CREATE OR REPLACE FUNCTION update_corporate_accounts_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS corporate_accounts_updated_at ON public.corporate_accounts;
CREATE TRIGGER corporate_accounts_updated_at
  BEFORE UPDATE ON public.corporate_accounts
  FOR EACH ROW EXECUTE FUNCTION update_corporate_accounts_updated_at();

-- 7. GRANTs
GRANT SELECT ON public.corporate_accounts TO anon;
