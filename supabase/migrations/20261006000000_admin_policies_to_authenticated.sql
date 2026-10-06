-- Restrict admin/owner policies to the authenticated role
--
-- Why: 20610031200000_lock_down_profile_reads.sql ran
--   REVOKE SELECT ON public.profiles FROM anon
-- to close the anonymous profiles leak. That broke anonymous reads of four
-- tables, because their RLS policies are visible to the `public` role (created
-- without a TO clause) and their USING clauses subquery profiles:
--
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ...)
--
-- Postgres must evaluate every applicable policy's qual, and evaluating that
-- subquery as anon now raises `permission denied for table profiles`, which
-- PostgREST surfaces as 401. The whole query fails — not just that row.
--
-- Observed against production immediately after the lockdown:
--
--   GET /rest/v1/advertisements     -> 401   (was 200)
--   GET /rest/v1/advert_leads       -> 401
--   GET /rest/v1/corporate_accounts -> 401
--   GET /rest/v1/corporate_members  -> 401
--   GET /rest/v1/jobs               -> 200
--
-- The visible symptom was corporate placements showing LIVE in the admin panel
-- while serving nothing to logged-out visitors: adDelivery.ts does
--   if (error || !ads || ads.length === 0) return [];
-- so the 401 became an empty banner silently. Authenticated admins still read
-- fine (anon was the only role revoked), which is why the badges looked healthy.
--
-- Why TO authenticated is the right fix, rather than anything cleverer:
--   For anon, auth.uid() is NULL, so `id = auth.uid()` is never true and every
--   one of these policies is already always-false. Restricting them to
--   authenticated changes nothing for anon semantically — it only stops anon
--   from having to parse a qual that references a table it can no longer read.
--   Logged-in behaviour is identical.
--
-- Rejected alternative: rewriting these to read user_roles instead of profiles.
-- user_roles contains a single row (role = 'admin'); the super_admin role that
-- these policies actually key off lives only in profiles. The rewrite would
-- have silently stripped super-admin privileges.
--
-- Tables with a trivially-true SELECT policy (testimonials, ad_impressions,
-- bids, portfolio_sites) survived the lockdown, because Postgres short-circuits
-- an OR whose other branch is `true` before touching profiles. Everything else
-- on the list was a landmine waiting for the first anon read.

-- ─── The four that are actually broken today ─────────────────────────────────

ALTER POLICY "Admins can manage ads" ON "public"."advertisements" TO "authenticated";
ALTER POLICY "Advertisers can manage own ads" ON "public"."advertisements" TO "authenticated";
ALTER POLICY "super_admin manage advert_leads" ON "public"."advert_leads" TO "authenticated";
ALTER POLICY "super_admin manages corporate_accounts" ON "public"."corporate_accounts" TO "authenticated";
ALTER POLICY "super_admin manages corporate_members" ON "public"."corporate_members" TO "authenticated";

-- ─── The rest: same defect, not yet reached by an anon code path ─────────────
-- Fixed in the same pass so the class of bug does not survive. Each of these
-- is also always-false for anon today, so none of them change behaviour.

ALTER POLICY "admins manage impressions" ON "public"."ad_impressions" TO "authenticated";
ALTER POLICY "auth_update_bids" ON "public"."bids" TO "authenticated";
ALTER POLICY "admins write billing_notifications" ON "public"."billing_notifications" TO "authenticated";
ALTER POLICY "super_admin manages invoices" ON "public"."corporate_invoices" TO "authenticated";
ALTER POLICY "super_admin read email_providers" ON "public"."email_providers" TO "authenticated";
ALTER POLICY "super_admin write email_providers" ON "public"."email_providers" TO "authenticated";
ALTER POLICY "auth_delete_jobs" ON "public"."jobs" TO "authenticated";
ALTER POLICY "auth_update_jobs" ON "public"."jobs" TO "authenticated";
ALTER POLICY "admin_read_update_messages" ON "public"."messages" TO "authenticated";
ALTER POLICY "admin_update_payments" ON "public"."payments" TO "authenticated";
ALTER POLICY "auth_read_payments" ON "public"."payments" TO "authenticated";
ALTER POLICY "admin write portfolio_sites" ON "public"."portfolio_sites" TO "authenticated";
ALTER POLICY "auth_delete_service_ads" ON "public"."service_ads" TO "authenticated";
ALTER POLICY "auth_update_service_ads" ON "public"."service_ads" TO "authenticated";
ALTER POLICY "admin write testimonials" ON "public"."testimonials" TO "authenticated";

-- Rolling back: re-run the same ALTER POLICY statements with TO PUBLIC. The
-- profiles REVOKE stays regardless — it is what closed the original leak.
