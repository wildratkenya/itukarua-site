-- Lock down public profile reads
--
-- Why: "public read profiles" was FOR SELECT USING (true), and anon has GRANT
-- ALL on the table. The anon key ships in the browser bundle, so every profile
-- row was readable without an account, including phone, email, whatsapp_number
-- and resume. Verified against production before writing this:
--
--   GET /rest/v1/profiles?select=id,full_name,phone,email&role=eq.jobseeker
--   -> 200, six jobseekers returned, every one with allow_contact_display = false
--
-- The contact-access window added last month did not close this. The gate lives
-- in the get_profile_contact RPC, but a SELECT * on the table bypasses the RPC
-- entirely, so the UI gate was cosmetic.
--
-- This migration replaces the blanket policy with three narrow ones plus a
-- column-limited view for the public worker directory.
--
-- Rolling back: re-add the policy at the bottom of this file. Nothing else needs
-- to change, because the view is additive and the code no longer depends on the
-- removed policy being present.

-- ─── 1. Remove the blanket read ───────────────────────────────────────────────

-- Original definition, kept here for reference:
--   CREATE POLICY "public read profiles" ON "public"."profiles"
--     FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read profiles" ON "public"."profiles";

-- Defence in depth. Logged-in requests resolve to the "authenticated" role, not
-- "anon", so revoking from anon only closes the true anonymous path.
REVOKE SELECT ON "public"."profiles" FROM "anon";

-- ─── 2. Narrow policies for the legitimate readers ────────────────────────────

-- A user may read their own row in full. Everything account-scoped (payments,
-- subscriptions, bids) already keys off this.
DROP POLICY IF EXISTS "profiles_select_own" ON "public"."profiles";
CREATE POLICY "profiles_select_own" ON "public"."profiles"
  FOR SELECT TO "authenticated"
  USING (("auth"."uid"() = "id"));

-- Admins keep the full row for the user table and the bidder modals. This reads
-- user_roles rather than profiles, which is what the existing admin_update and
-- admin_delete policies do; a subquery on profiles would re-enter this policy
-- and recurse.
DROP POLICY IF EXISTS "profiles_select_admin" ON "public"."profiles";
CREATE POLICY "profiles_select_admin" ON "public"."profiles"
  FOR SELECT TO "authenticated"
  USING ((EXISTS (
    SELECT 1 FROM "public"."user_roles"
    WHERE ("user_roles"."id" = "auth"."uid"())
      AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))
  )));

-- ─── 3. Public worker directory ───────────────────────────────────────────────

-- Replaces the public reads of profiles from the worker cards, the search modal,
-- the top-rated modal and the home page.
--
-- Deliberately NOT security_invoker, so it is evaluated with the owner's
-- privileges and bypasses the RLS above. That is the point: the column list is
-- the access control. Adding security_invoker here would re-apply the policies
-- and return nothing to anonymous visitors.
--
-- allow_contact_display is included because WorkerSearchModal renders an
-- "opted out" notice from it. It discloses consent state, not contact details,
-- and the actual contact fields stay gated behind get_profile_contact.
-- Column list mirrors what the call sites already asked for via
-- getProfiles(), minus the three contact fields none of them requested. Keeping
-- it identical avoids changing what any screen renders while moving the read
-- off the base table.
--
-- account-state columns (subscription_expires_at, registration_paid,
-- terms_accepted, suspended) stay because getProfiles() orders by
-- subscription_expires_at to float active subscribers, and callers filter on
-- suspended. They expose paid/consent state to anonymous visitors, which is
-- mild and not contact data. If that is unwanted, filter suspended = false
-- inside the view and drop the ordering.
-- getBillingItems() and the admin STK push still need email and phone for other
-- users. They stay on the base table, which profiles_select_admin permits and
-- the view deliberately cannot serve.
DROP VIEW IF EXISTS "public"."public_worker_directory" CASCADE;

CREATE VIEW "public"."public_worker_directory" AS
SELECT
  p."id",
  p."full_name",
  p."profile_image",
  p."rating",
  p."reviews_count",
  p."skills",
  p."qualifications",
  p."experience",
  p."certificates",
  p."location",
  p."county",
  p."subcounty",
  p."role",
  p."verified",
  p."created_at",
  p."updated_at",
  p."likes_count",
  p."dislikes_count",
  p."profile_views",
  p."is_featured",
  p."ratings_enabled",
  p."registration_paid",
  p."subscription_expires_at",
  p."terms_accepted",
  p."data_sharing_consent",
  p."accepted_terms_at",
  p."suspended",
  p."allow_contact_display"
FROM "public"."profiles" p;

COMMENT ON VIEW "public"."public_worker_directory" IS
  'Card-safe worker profile projection. No phone, email, whatsapp_number or '
  'resume. Contact access is gated by get_profile_contact.';

REVOKE ALL ON "public"."public_worker_directory" FROM "anon";
GRANT SELECT ON "public"."public_worker_directory" TO "anon";
GRANT SELECT ON "public"."public_worker_directory" TO "authenticated";

-- ─── 4. Signup duplicate check without handing back the row ───────────────────

-- AuthModal used select('email').ilike('email', x) to detect a duplicate
-- registration, which returned the matching row and confirmed that an address
-- was registered. This returns a boolean instead.
CREATE OR REPLACE FUNCTION "public"."email_is_registered"(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE lower("email") = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION "public"."email_is_registered"(TEXT) FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."email_is_registered"(TEXT) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."email_is_registered"(TEXT) TO "authenticated";

-- Note: this function is SECURITY DEFINER with no rate limit. It answers "is
-- this email registered", which is inherent to duplicate detection at signup.
-- Worth a captcha or throttling before public launch.