-- Add profile_views column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_views integer DEFAULT 0;

-- RPC to increment profile views
CREATE OR REPLACE FUNCTION public.increment_profile_views(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET profile_views = COALESCE(profile_views, 0) + 1 WHERE id = p_profile_id;
END;
$$;

-- Newsletter subscribers table
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Everyone can insert (subscribe)
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

-- Only authenticated users can view subscribers
CREATE POLICY "Authenticated users can view subscribers" ON public.newsletter_subscribers
  FOR SELECT USING (auth.role() = 'authenticated');
