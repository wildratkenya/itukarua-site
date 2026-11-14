-- Migration: Enforce free-tier bid limit server-side
--
-- Prevent non-premium jobseekers from exceeding 10 bids per rolling 7 days.
-- Enforced via a BEFORE INSERT trigger on public.bids so direct PostgREST
-- calls cannot bypass the client-side check in src/lib/database.ts.
--
-- Premium jobseekers (paid jobseeker entitlement in profile_roles, or legacy
-- profiles.subscription_expires_at > now()) are exempt.

BEGIN;

-- 1. Harden INSERT RLS: a client may only bid as itself (bidder_id = auth.uid()).
--    The existing "auth_insert_bids" policy only checks auth.uid() IS NOT NULL,
--    which lets a client spoof bidder_id. Replace it with an owner-only policy.
DROP POLICY IF EXISTS "auth_insert_bids" ON public.bids;
CREATE POLICY "auth_insert_bids_own"
  ON public.bids
  FOR INSERT
  TO authenticated
  WITH CHECK (bidder_id = auth.uid());

-- 2. Trigger function: enforce the 10-bid / rolling-7-day Free cap.
--    Uses an advisory transaction lock so concurrent PostgREST inserts from the
--    same user cannot race past the count of 10.
CREATE OR REPLACE FUNCTION public.enforce_free_bid_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_premium boolean;
  bid_count integer;
BEGIN
  -- Serialize per bidder to prevent concurrent-request races past the cap.
  PERFORM pg_advisory_xact_lock(hashtext('bid_limit:' || NEW.bidder_id::text));

  -- Premium check: paid jobseeker entitlement OR legacy subscription mirror.
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles pr
    WHERE pr.user_id = NEW.bidder_id
      AND pr.role = 'jobseeker'
      AND pr.paid = true
      AND pr.expires_at > now()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.bidder_id
      AND p.subscription_expires_at > now()
  ) INTO is_premium;

  IF is_premium THEN
    RETURN NEW;
  END IF;

  -- Count ALL bids by this user in the rolling 7-day window (all categories).
  SELECT count(*) INTO bid_count
  FROM public.bids
  WHERE bidder_id = NEW.bidder_id
    AND created_at > now() - interval '7 days';

  IF bid_count >= 10 THEN
    RAISE EXCEPTION 'FREE_BID_LIMIT_REACHED: Free tier allows 10 bids per rolling 7 days. Upgrade to Premium for unlimited bids.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach the trigger (before existing on_bid_insert so the cap is checked first).
DROP TRIGGER IF EXISTS trg_enforce_free_bid_limit ON public.bids;
CREATE TRIGGER trg_enforce_free_bid_limit
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_bid_limit();

COMMIT;

-- ─── Verification tests (run separately against a dev database) ─────────────
-- Each block is wrapped in BEGIN; ... ROLLBACK; so no dummy bids persist.
-- The free-user block is expected to error on the 11th bid — that rolls back
-- the whole block, leaving no rows behind.

-- Test A: Free jobseeker — 11th bid in 7 days is rejected.
BEGIN;
  INSERT INTO public.profiles (id, role, registration_paid, subscription_expires_at, terms_accepted, accepted_terms_at, terms_version, privacy_version, age_attested_at)
  VALUES ('11111111-1111-1111-1111-111111111111', 'jobseeker', false, null, true, now(), '2.0', '2.0', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.bids (job_id, bidder_id, price, proposal, status)
  SELECT gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 1000, 'test bid', 'pending'
  FROM generate_series(1, 10);

  -- This 11th insert must be rejected with FREE_BID_LIMIT_REACHED.
  INSERT INTO public.bids (job_id, bidder_id, price, proposal, status)
  VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 1000, 'test bid 11', 'pending');
ROLLBACK;

-- Test B: Premium jobseeker — 11 bids in 7 days are all allowed.
BEGIN;
  INSERT INTO public.profiles (id, role, registration_paid, subscription_expires_at, terms_accepted, accepted_terms_at, terms_version, privacy_version, age_attested_at)
  VALUES ('22222222-2222-2222-2222-222222222222', 'jobseeker', false, null, true, now(), '2.0', '2.0', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profile_roles (user_id, role, paid, expires_at, token_days)
  VALUES ('22222222-2222-2222-2222-222222222222', 'jobseeker', true, now() + interval '30 days', 0)
  ON CONFLICT (user_id, role) DO UPDATE SET paid = true, expires_at = now() + interval '30 days';

  -- All 11 inserts should succeed for a Premium user.
  INSERT INTO public.bids (job_id, bidder_id, price, proposal, status)
  SELECT gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 1000, 'premium test bid', 'pending'
  FROM generate_series(1, 11);
ROLLBACK;
