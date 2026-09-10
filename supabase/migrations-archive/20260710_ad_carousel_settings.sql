-- Homepage ad carousel settings (scroll speed, transition duration, effect)
CREATE TABLE IF NOT EXISTS public.ad_carousel_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ad_carousel_settings OWNER TO postgres;
ALTER TABLE public.ad_carousel_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read ad_carousel_settings" ON public.ad_carousel_settings;
DROP POLICY IF EXISTS "admin update ad_carousel_settings" ON public.ad_carousel_settings;

CREATE POLICY "public read ad_carousel_settings" ON public.ad_carousel_settings
  FOR SELECT USING (true);

CREATE POLICY "admin update ad_carousel_settings" ON public.ad_carousel_settings
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.ad_carousel_settings (key, value) VALUES
  ('scroll_interval_seconds', '5'),
  ('transition_duration_seconds', '0.8'),
  ('effect', 'slide')
ON CONFLICT (key) DO NOTHING;
