-- Self-service corporate signup (Partnerships on /pricing): an email
-- verification code is stored here before the account is provisioned by the
-- verify-corporate-otp edge function. Internal table, service-role only.

CREATE TABLE IF NOT EXISTS public.corporate_signups (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text        NOT NULL,
  otp_code    text        NOT NULL,
  signup_data jsonb       NOT NULL,
  expires_at  timestamptz NOT NULL,
  used        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corporate_signups_email ON public.corporate_signups(email);

COMMENT ON TABLE public.corporate_signups IS
  'Pending corporate self-service signups, keyed by email + OTP code. Records are one-time use.';