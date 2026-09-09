-- Newsletter spam hardening: server-side validation, per-email rate limiting,
-- case-insensitive deduplication, and a stricter insert policy for the public
-- subscribe path.

-- The base newsletter table predates the name column used by the admin UI.
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS name text;

-- Collapse any legacy case-variant duplicates (keep the earliest subscribe) so
-- the unique index below can be created safely.
DELETE FROM public.newsletter_subscribers a
  USING public.newsletter_subscribers b
  WHERE a.id <> b.id
    AND a.created_at > b.created_at
    AND lower(a.email) = lower(b.email);

-- Prevent "Foo@Bar.com" and "foo@bar.com" from both subscribing.
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_lower_key
  ON public.newsletter_subscribers (lower(email));

-- Belt-and-braces: tighten the anonymous INSERT policy to match our email
-- format. The hardened RPC below is the authoritative gate and bypasses RLS.
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,63}$');

-- Hardened subscribe function used by the app. Returns an error message
-- (or '' on success) instead of raising, so callers can show friendly text.
CREATE OR REPLACE FUNCTION public.newsletter_subscribe(p_email text, p_name text DEFAULT '')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(p_email);
  v_domain text;
  v_hour_ago timestamptz := now() - interval '1 hour';
  v_recent integer;
BEGIN
  -- Format basics.
  IF v_email IS NULL OR v_email = ''
     OR length(v_email) > 254
     OR position('@' in v_email) <= 1
  THEN
    RETURN 'Invalid email';
  END IF;
  v_domain := substring(v_email from position('@' in v_email) + 1);
  IF v_domain = ''
     OR v_domain !~ '^[a-z0-9.-]+\.[a-z]{2,63}$'
     OR v_domain ~* '(^|\.)(local|internal|invalid|test|example|fake)(\.|$)'
  THEN
    RETURN 'Invalid email';
  END IF;

  -- Reject role accounts (admin@, info@, ...).
  IF v_email ~* '^(admin|info|support|contact|sales|helpdesk|help|office|webmaster|postmaster|hostmaster|noreply|no-reply|mailer|root|security|billing|accounts|team|hello|test|temp|mail|spam|reviews)@'
  THEN
    RETURN 'Invalid email';
  END IF;

  -- Reject well-known disposable/temporary domains.
  IF v_email ~ '@([a-z0-9-]*\.)*(mailinator|guerrillamail|yopmail|temp-mail|tempmail|10minutemail|10mail|trashmail|maildrop|dispostable|throwawaymail|mailnesia|shutcmail|getnada|emailondeck|0-mail|maileater|mailcatch|mintemail|spamgourmet|fakeinbox|dropmail|mytemp|emailias|pokemail|telegmail|dumpmail|jetable|meltmail|spamfree24)\.'
  THEN
    RETURN 'Invalid email';
  END IF;

  -- Rate limit: at most 3 subscribe attempts per email within any hour.
  SELECT count(*) INTO v_recent
    FROM public.newsletter_subscribers
   WHERE lower(email) = v_email
     AND created_at >= v_hour_ago;
  IF v_recent >= 3 THEN
    RETURN 'Too many attempts. Please try again later.';
  END IF;

  BEGIN
    INSERT INTO public.newsletter_subscribers (email, name)
    VALUES (v_email, p_name);
  EXCEPTION WHEN unique_violation THEN
    RETURN 'This email is already subscribed.';
  END;

  RETURN '';
END;
$$;

GRANT EXECUTE ON FUNCTION public.newsletter_subscribe(text, text) TO anon, authenticated;