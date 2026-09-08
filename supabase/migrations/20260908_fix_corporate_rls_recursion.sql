-- Fix RLS infinite recursion on corporate_members.
-- The self-referential membership policies errored ("infinite recursion detected"),
-- which also broke every read that evaluates a corporate membership subquery
-- (public advertisements SELECTs returned HTTP 500, hiding all banners).
-- Replace EXISTS-on-corporate_members policy checks with SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.is_corporate_member(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_members cm
    WHERE cm.account_id = p_account_id
      AND cm.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_corporate_owner(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_members cm
    WHERE cm.account_id = p_account_id
      AND cm.profile_id = auth.uid()
      AND cm.member_role = 'owner'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_corporate_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_corporate_owner(uuid) TO anon, authenticated;

-- corporate_accounts
DROP POLICY IF EXISTS "corporate members read account" ON public.corporate_accounts;
CREATE POLICY "corporate members read account" ON public.corporate_accounts
  FOR SELECT USING (
    is_active = true
    AND public.is_corporate_member(id)
  );

DROP POLICY IF EXISTS "corporate owners update account" ON public.corporate_accounts;
CREATE POLICY "corporate owners update account" ON public.corporate_accounts
  FOR UPDATE USING (public.is_corporate_owner(id));

-- corporate_members
DROP POLICY IF EXISTS "corporate members read own members" ON public.corporate_members;
CREATE POLICY "corporate members read own members" ON public.corporate_members
  FOR SELECT USING (public.is_corporate_member(account_id));

DROP POLICY IF EXISTS "corporate owners manage members" ON public.corporate_members;
CREATE POLICY "corporate owners manage members" ON public.corporate_members
  FOR ALL USING (public.is_corporate_owner(account_id))
  WITH CHECK (public.is_corporate_owner(account_id));

-- advertisements
DROP POLICY IF EXISTS "corporate members read own ads" ON public.advertisements;
CREATE POLICY "corporate members read own ads" ON public.advertisements
  FOR SELECT USING (
    corporate_account_id IS NOT NULL
    AND public.is_corporate_member(corporate_account_id)
  );

DROP POLICY IF EXISTS "corporate members insert own ads" ON public.advertisements;
CREATE POLICY "corporate members insert own ads" ON public.advertisements
  FOR INSERT WITH CHECK (
    corporate_account_id IS NOT NULL
    AND public.is_corporate_member(corporate_account_id)
  );

DROP POLICY IF EXISTS "corporate members manage own ads" ON public.advertisements;
CREATE POLICY "corporate members manage own ads" ON public.advertisements
  FOR UPDATE USING (
    corporate_account_id IS NOT NULL
    AND public.is_corporate_member(corporate_account_id)
  );

-- advert_analytics
DROP POLICY IF EXISTS "corporate read own analytics" ON public.advert_analytics;
CREATE POLICY "corporate read own analytics" ON public.advert_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.advertisements a
      WHERE a.id = advert_analytics.ad_id
        AND public.is_corporate_member(a.corporate_account_id)
    )
  );

-- payments
DROP POLICY IF EXISTS "corporate read own invoices" ON public.payments;
CREATE POLICY "corporate read own invoices" ON public.payments
  FOR SELECT USING (
    (related_ad_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.advertisements a
      WHERE a.id = payments.related_ad_id::uuid
        AND public.is_corporate_member(a.corporate_account_id)
    ))
  );