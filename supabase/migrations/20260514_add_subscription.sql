-- Add subscription_expires_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone;

-- Create platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key text PRIMARY KEY,
    value numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.platform_settings OWNER TO postgres;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read platform_settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "admin update platform_settings" ON public.platform_settings
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "admin insert platform_settings" ON public.platform_settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Seed default fee values
INSERT INTO public.platform_settings (key, value) VALUES
  ('jobseeker_registration_fee', 100),
  ('contact_access_fee', 100)
ON CONFLICT (key) DO NOTHING;
