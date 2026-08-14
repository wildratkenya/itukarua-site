-- Client testimonials for the homepage "What Clients Say" section.
-- Visible to everyone; managed by admins / super_admins.
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  company text,
  comment text NOT NULL,
  rating integer DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.testimonials OWNER TO postgres;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "admin write testimonials" ON public.testimonials;

-- Everyone can read testimonials (homepage display).
CREATE POLICY "public read testimonials" ON public.testimonials
  FOR SELECT USING (true);

-- Only admins / super_admins can insert, update or delete testimonials.
CREATE POLICY "admin write testimonials" ON public.testimonials
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- Websites scroller settings (5 sites per slide, effect, interval)
INSERT INTO public.ad_carousel_settings (key, value) VALUES
  ('web_scroll_interval_seconds', '5'),
  ('web_transition_duration_seconds', '0.8'),
  ('web_effect', 'slide')
ON CONFLICT (key) DO NOTHING;

-- Portfolio sites for the homepage "Websites We Build" scroller.
-- Each site can have a live URL and/or an uploaded screenshot image.
CREATE TABLE IF NOT EXISTS public.portfolio_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text,
  image_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.portfolio_sites OWNER TO postgres;
ALTER TABLE public.portfolio_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read portfolio_sites" ON public.portfolio_sites;
DROP POLICY IF EXISTS "admin write portfolio_sites" ON public.portfolio_sites;

-- Everyone can read portfolio sites (homepage display).
CREATE POLICY "public read portfolio_sites" ON public.portfolio_sites
  FOR SELECT USING (true);

-- Only admins / super_admins can manage portfolio sites.
CREATE POLICY "admin write portfolio_sites" ON public.portfolio_sites
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- Seed the existing sites
INSERT INTO public.portfolio_sites (title, description, url, image_url, sort_order) VALUES
  ('Prefetch Systems', 'IT solutions & web services', 'https://prefetchsystems.co.ke', NULL, 0),
  ('The Market Color Podcast', 'Podcast & media platform', 'https://themarketcolorpodcast.com', NULL, 1),
  ('ALC DJ', 'DJ booking & entertainment', 'https://alcdj.org', NULL, 2),
  ('Itukarua', 'Local jobs & services hub', 'https://itukarua3.vercel.app', NULL, 3)
ON CONFLICT DO NOTHING;
