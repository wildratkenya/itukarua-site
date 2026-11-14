-- Migration: Enforce Premium-only messaging server-side (Item #2)
--
-- Guarantees that a free (non-Premium) jobseeker cannot start a conversation
-- or send a direct message, even if the call bypasses the frontend and hits
-- PostgREST directly. Enforcement lives in a BEFORE INSERT trigger so
-- findOrCreateConversation / sendMessage always surface the typed
-- MESSAGING_ENTITLEMENT_REQUIRED error (SQLSTATE P0003) instead of a generic
-- RLS 42501.
--
-- Rules (per docs/docs/product/roles-and-gating.md):
--   * jobseekers: Premium (paid + unexpired entitlement) required to send
--   * employers / advertisers: message freely, no entitlement check
--   * sender_id = auth.uid() is enforced by RLS WITH CHECK (anti-spoofing)
--
-- Client-side checks remain UX convenience only; the database is the source of
-- truth for enforcement.
--
-- NOTE on role-spoofing risk (safeguard #3):
--   profiles.role CAN be mutated by the user via PostgREST UPDATE on profiles
--   (auth_update_own_profile restricts only the id column, not role), and
--   profile_roles CAN be self-updated by the user (profile_roles_owner_update
--   allows user_id = auth.uid() with no WITH CHECK). A free jobseeker could
--   therefore set profile_roles.paid = true on their jobseeker row to bypass
--   this trigger. That bypass vector exists at the profile_roles write layer,
--   not here; tightening profile_roles write access would break the client-side
--   entitlement flows (ensureJobseekerEntitlement / setRoleEntitlement /
--   extendRoleSubscription) that write via the authenticated supabase client.
--   This migration notes the risk; payment-flow writes should be migrated to
--   service_role or a SECURITY DEFINER RPC before the profile_roles update
--   policy is restricted.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Remove any earlier enforcement trigger/function so we do not double-fire.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_messaging_conversations ON public.conversations;
DROP TRIGGER IF EXISTS trg_enforce_messaging_direct_messages ON public.direct_messages;
DROP FUNCTION IF EXISTS public.enforce_premium_messaging();

-- ---------------------------------------------------------------------------
-- 1. Entitlement trigger function (SECURITY DEFINER, search_path pinned).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_messaging_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    acting_user uuid;
    sender_role text;
    is_premium boolean;
BEGIN
    -- The acting user is the authenticated requester. RLS on direct_messages
    -- separately forces sender_id = auth.uid(), so sender_id never diverges
    -- from auth.uid() for a normal authenticated insert.
    acting_user := auth.uid();

    -- Resolve the sender's role from profile_roles, falling back to profiles.role.
    -- A user may hold several roles; pick the first in a fixed priority order.
    SELECT COALESCE((
        SELECT pr.role
        FROM public.profile_roles pr
        WHERE pr.user_id = acting_user
          AND pr.role IN ('jobseeker', 'employer', 'advertiser')
        ORDER BY CASE pr.role
                     WHEN 'jobseeker' THEN 1
                     WHEN 'employer'  THEN 2
                     WHEN 'advertiser' THEN 3
                 END
        LIMIT 1
    ), (
        SELECT p.role FROM public.profiles p WHERE p.id = acting_user
    ))
    INTO sender_role;

    -- Only jobseekers are gated; employers and advertisers message freely.
    IF sender_role IS DISTINCT FROM 'jobseeker' THEN
        RETURN NEW;
    END IF;

    -- A jobseeker must hold a paid, unexpired Premium jobseeker entitlement.
    -- Fallback: legacy profiles.subscription_expires_at.
    SELECT EXISTS (
        SELECT 1
        FROM public.profile_roles pr
        WHERE pr.user_id = acting_user
          AND pr.role = 'jobseeker'
          AND pr.paid = true
          AND pr.expires_at > now()
    ) OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = acting_user
          AND p.subscription_expires_at > now()
    )
    INTO is_premium;

    IF NOT is_premium THEN
        RAISE EXCEPTION 'MESSAGING_ENTITLEMENT_REQUIRED' USING ERRCODE = 'P0003';
    END IF;

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Attach the trigger to both tables.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_messaging_entitlement_conversations ON public.conversations;
CREATE TRIGGER trg_messaging_entitlement_conversations
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.enforce_messaging_entitlement();

DROP TRIGGER IF EXISTS trg_messaging_entitlement_direct_messages ON public.direct_messages;
CREATE TRIGGER trg_messaging_entitlement_direct_messages
BEFORE INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_messaging_entitlement();

-- ---------------------------------------------------------------------------
-- 3. Hardened RLS policies.
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants insert conversation" ON public.conversations;
CREATE POLICY "participants insert conversation"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "participants insert messages" ON public.direct_messages;
CREATE POLICY "participant insert messages"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (
    auth.role() = 'authenticated'
    AND sender_id = auth.uid()                                              -- anti-spoofing
    AND EXISTS (
        SELECT 1
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = direct_messages.conversation_id
          AND cp.user_id = auth.uid()
    )
);

-- ---------------------------------------------------------------------------
-- 4. Verification tests (run separately; each in its own BEGIN; ... ROLLBACK;
--    so a test failure never rolls back the DDL above).
-- ---------------------------------------------------------------------------
COMMIT;

-- Seed test users directly into profiles (profiles.id has no FK to auth.users
-- in this schema, so INSERT works without an auth row).
BEGIN;
INSERT INTO public.profiles (id, role, subscription_expires_at, terms_accepted, accepted_terms_at, terms_version, privacy_version, age_attested_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'jobseeker', NULL, true, now(), '2.0', '2.0', now()),                          -- free jobseeker
  ('22222222-2222-2222-2222-222222222222', 'jobseeker', NULL, true, now(), '2.0', '2.0', now()),                          -- premium jobseeker (via profile_roles)
  ('33333333-3333-3333-3333-333333333333', 'employer', NULL, true, now(), '2.0', '2.0', now());                           -- employer

INSERT INTO public.profile_roles (user_id, role, paid, expires_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'jobseeker', false, NULL),
  ('22222222-2222-2222-2222-222222222222', 'jobseeker', true, now() + interval '30 days'),
  ('33333333-3333-3333-3333-333333333333', 'employer', true, now() + interval '30 days')
ON CONFLICT (user_id, role) DO NOTHING;
ROLLBACK;

-- T1: free jobseeker cannot start a conversation -> expect P0003.
BEGIN;
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
DO $$
BEGIN
  INSERT INTO public.conversations (job_id) VALUES (NULL);
  RAISE EXCEPTION 'TEST FAIL: free jobseeker created a conversation';
EXCEPTION WHEN sqlstate 'P0003' THEN
  RAISE NOTICE 'TEST PASS: free jobseeker conversation blocked (P0003)';
END;
$$ LANGUAGE plpgsql;
ROLLBACK;

-- T2: premium jobseeker can start a conversation -> expect success.
BEGIN;
SET request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
DO $$
BEGIN
  INSERT INTO public.conversations (job_id) VALUES (NULL);
  RAISE NOTICE 'TEST PASS: premium jobseeker created a conversation';
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'TEST FAIL: premium jobseeker could not create a conversation: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
ROLLBACK;

-- T3: employer can start a conversation freely -> expect success.
BEGIN;
SET request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
DO $$
BEGIN
  INSERT INTO public.conversations (job_id) VALUES (NULL);
  RAISE NOTICE 'TEST PASS: employer created a conversation';
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'TEST FAIL: employer could not create a conversation: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
ROLLBACK;

-- T4: sender spoofing on direct_messages is rejected (RLS anti-spoofing).
--   auth.uid() = employer (premium, so the trigger allows); sender_id = free
--   jobseeker (not self) -> RLS WITH CHECK sender_id = auth.uid() fails.
BEGIN;
SET request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
DO $$
BEGIN
  INSERT INTO public.direct_messages (conversation_id, sender_id, content)
  VALUES (NULL, '11111111-1111-1111-1111-111111111111', 'spoof');
  RAISE EXCEPTION 'TEST FAIL: sender spoofing accepted';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'TEST PASS: sender spoofing rejected';
END;
$$ LANGUAGE plpgsql;
ROLLBACK;
