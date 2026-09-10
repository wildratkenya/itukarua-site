-- Email providers for the admin "Email" tab and the newsletter sender.
-- SMTP credentials are stored as Supabase secrets (SMTP_HOST / SMTP_USER /
-- SMTP_PASS / SMTP_PORT / SMTP_FROM_NAME / SMTP_FROM_EMAIL), never in this
-- table. The table only keeps provider metadata for the admin UI.
CREATE TABLE IF NOT EXISTS public.email_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  imap_host text,
  imap_port integer DEFAULT 993,
  smtp_host text NOT NULL,
  smtp_port integer DEFAULT 465,
  from_name text,
  from_email text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_providers OWNER TO postgres;
ALTER TABLE public.email_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read email_providers" ON public.email_providers;
DROP POLICY IF EXISTS "authenticated write email_providers" ON public.email_providers;

-- Only super_admins can read/write provider rows.
CREATE POLICY "super_admin read email_providers" ON public.email_providers
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "super_admin write email_providers" ON public.email_providers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

