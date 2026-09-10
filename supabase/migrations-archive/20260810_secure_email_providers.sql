-- Harden email_providers: credentials live in Supabase secrets (edge function
-- env), not in the DB or seed files. The table is admin-only and the seeded
-- SMTP credentials are removed.

DELETE FROM public.email_providers WHERE username = 'sam@prefetchsystems.co.ke';

DROP POLICY IF EXISTS "authenticated read email_providers" ON public.email_providers;
DROP POLICY IF EXISTS "authenticated write email_providers" ON public.email_providers;

-- Only super_admins can read/write the (now metadata-only) provider rows.
CREATE POLICY "super_admin read email_providers" ON public.email_providers
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "super_admin write email_providers" ON public.email_providers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
