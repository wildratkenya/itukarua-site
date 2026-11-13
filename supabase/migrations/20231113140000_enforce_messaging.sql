-- Migration: Enforce premium‑only messaging server‑side
-- Prevent non‑premium jobseekers from inserting rows into
-- `conversations` and `direct_messages`. The same entitlement logic
-- as the bid‑limit trigger is used.

BEGIN;

-- 1. Trigger function to verify premium status
CREATE OR REPLACE FUNCTION public.enforce_premium_messaging()
RETURNS trigger AS $$
DECLARE
    is_premium boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.profile_roles pr
        WHERE pr.user_id = NEW.sender_id
          AND pr.role = 'jobseeker'
          AND pr.paid = true
          AND pr.expires_at > now()
    ) OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = NEW.sender_id
          AND p.subscription_expires_at > now()
    ) INTO is_premium;

    IF NOT is_premium THEN
        RAISE EXCEPTION 'ENTITLEMENT_REQUIRED' USING ERRCODE = 'P0002';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Attach the trigger to both tables
DROP TRIGGER IF EXISTS trg_enforce_messaging_conversations ON public.conversations;
CREATE TRIGGER trg_enforce_messaging_conversations
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.enforce_premium_messaging();

DROP TRIGGER IF EXISTS trg_enforce_messaging_direct_messages ON public.direct_messages;
CREATE TRIGGER trg_enforce_messaging_direct_messages
BEFORE INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_premium_messaging();

-- 3. Revoke direct INSERT privilege from the authenticated role
REVOKE INSERT ON public.conversations FROM authenticated;
REVOKE INSERT ON public.direct_messages FROM authenticated;

-- 4. RPC for safe message creation (for conversations)
CREATE OR REPLACE FUNCTION public.send_conversation_message(
    p_conversation_id uuid,
    p_sender_id uuid,
    p_content text
) RETURNS uuid AS $$
DECLARE
    new_msg_id uuid;
BEGIN
    INSERT INTO public.conversations (id, sender_id, content, created_at, updated_at)
    VALUES (p_conversation_id, p_sender_id, p_content, now(), now())
    RETURNING id INTO new_msg_id;
    RETURN new_msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;

