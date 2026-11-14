-- Migration: Re-apply Premium messaging enforcement triggers (Item #2 fix)
--
-- The previous migration 20261114130000 recorded as applied on remote but the
-- DDL did not take effect: triggers trg_messaging_entitlement_conversations /
-- trg_messaging_entitlement_direct_messages are missing. Additionally, the
-- earlier migration 20231113140000 revoked INSERT on conversations /
-- direct_messages from authenticated, which blocks INSERTs before any BEFORE
-- INSERT trigger can fire. This migration re-grants INSERT and idempotently
-- recreates the entitlement triggers and RLS policies.

BEGIN;

-- 0. Remove any earlier enforcement triggers/functions so we do not double-fire.
DROP TRIGGER IF EXISTS trg_enforce_messaging_conversations ON public.conversations;
DROP TRIGGER IF EXISTS trg_enforce_messaging_direct_messages ON public.direct_messages;
DROP TRIGGER IF EXISTS trg_messaging_entitlement_conversations ON public.conversations;
DROP TRIGGER IF EXISTS trg_messaging_entitlement_direct_messages ON public.direct_messages;
DROP FUNCTION IF EXISTS public.enforce_premium_messaging();
DROP FUNCTION IF EXISTS public.enforce_messaging_entitlement();

-- 1. Re-grant INSERT to authenticated (revoked by 20231113140000). RLS policies
--    below then restrict who may actually insert.
GRANT INSERT ON public.conversations TO authenticated;
GRANT INSERT ON public.direct_messages TO authenticated;

-- 2. Entitlement trigger function (SECURITY DEFINER, search_path pinned).
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
    acting_user := auth.uid();

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

    IF sender_role IS DISTINCT FROM 'jobseeker' THEN
        RETURN NEW;
    END IF;

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

-- 3. Attach the trigger to both tables.
CREATE TRIGGER trg_messaging_entitlement_conversations
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.enforce_messaging_entitlement();

CREATE TRIGGER trg_messaging_entitlement_direct_messages
BEFORE INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_messaging_entitlement();

-- 4. Hardened RLS policies.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants insert conversation" ON public.conversations;
CREATE POLICY "participants insert conversation"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "participant insert messages" ON public.direct_messages;
CREATE POLICY "participant insert messages"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (
    auth.role() = 'authenticated'
    AND sender_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = direct_messages.conversation_id
          AND cp.user_id = auth.uid()
    )
);

COMMIT;
