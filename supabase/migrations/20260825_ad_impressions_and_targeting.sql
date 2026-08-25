-- Ad impression tracking + frequency capping + fair rotation + geo-targeting
-- Run this in Supabase Dashboard SQL Editor

-- 1. ad_impressions table
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id uuid NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  county text,
  subcounty text,
  served_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_visitor ON public.ad_impressions(ad_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_served ON public.ad_impressions(ad_id, served_at);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_visitor_served ON public.ad_impressions(visitor_id, served_at);

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon can insert impressions" ON public.ad_impressions;
CREATE POLICY "anon can insert impressions" ON public.ad_impressions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "public read impressions" ON public.ad_impressions;
CREATE POLICY "public read impressions" ON public.ad_impressions FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage impressions" ON public.ad_impressions;
CREATE POLICY "admins manage impressions" ON public.ad_impressions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
GRANT INSERT, SELECT ON public.ad_impressions TO anon, authenticated;

-- 2. Geo-targeting columns on advertisements
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS target_county text;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS target_subcounty text;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS expected_impressions integer;
CREATE INDEX IF NOT EXISTS idx_advertisements_target ON public.advertisements(target_county, target_subcounty, slot, active);

-- 3. Frequency cap RPC
CREATE OR REPLACE FUNCTION count_visitor_impressions(p_ad_id uuid, p_visitor_id text, p_days integer DEFAULT 7)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::integer FROM public.ad_impressions
  WHERE ad_id = p_ad_id AND visitor_id = p_visitor_id
    AND served_at >= now() - (p_days || ' days')::interval;
$$;

-- 4. Delivery pace RPC
CREATE OR REPLACE FUNCTION get_delivery_pace(p_ad_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$
  WITH ad_info AS (
    SELECT billing_start, billing_end, COALESCE(expected_impressions, 1000) AS expected_total
    FROM advertisements WHERE id = p_ad_id
  ),
  elapsed AS (
    SELECT GREATEST(EXTRACT(EPOCH FROM (now() - billing_start)) / GREATEST(EXTRACT(EPOCH FROM (billing_end - billing_start)), 1), 0.01) AS fraction_elapsed,
           expected_total FROM ad_info
  ),
  actual AS (
    SELECT COUNT(*)::numeric AS cnt FROM ad_impressions
    WHERE ad_id = p_ad_id AND served_at >= (SELECT billing_start FROM ad_info)
  )
  SELECT CASE WHEN (SELECT fraction_elapsed FROM elapsed) <= 0 THEN 1.0
    ELSE (SELECT cnt FROM actual) / ((SELECT fraction_elapsed FROM elapsed) * (SELECT expected_total FROM elapsed))
  END;
$$;

-- 5. Impressions by county RPC
CREATE OR REPLACE FUNCTION get_impressions_by_county(p_ad_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE(county text, impressions bigint, clicks bigint) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(ai.county, 'Unknown') AS county,
    COUNT(*) FILTER (WHERE ai.event_type = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE ai.event_type = 'click') AS clicks
  FROM advert_analytics ai
  WHERE ai.ad_id = p_ad_id AND ai.created_at >= now() - (p_days || ' days')::interval
  GROUP BY COALESCE(ai.county, 'Unknown') ORDER BY impressions DESC;
$$;
