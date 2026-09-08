-- The edge functions create corporate accounts via a service-role client, which
-- bypasses RLS but still requires table grants. The original corporate migration
-- only granted authenticated/anon, so service-role inserts failed with
-- "permission denied for table corporate_accounts".

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;