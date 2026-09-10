-- Analytics tables for user dashboard
-- Run this in Supabase Dashboard SQL Editor

-- 1. Profile views log
CREATE TABLE IF NOT EXISTS profile_views_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_log_profile_id ON profile_views_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_log_created_at ON profile_views_log(created_at);
CREATE INDEX IF NOT EXISTS idx_profile_views_log_profile_created ON profile_views_log(profile_id, created_at);

ALTER TABLE profile_views_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert profile views"
  ON profile_views_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own profile view logs"
  ON profile_views_log FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- 2. Site visits log
CREATE TABLE IF NOT EXISTS site_visits_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_log_created_at ON site_visits_log(created_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_log_user_id ON site_visits_log(user_id);

ALTER TABLE site_visits_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert site visits"
  ON site_visits_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own site visits"
  ON site_visits_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. RPC: get_profile_view_history
CREATE OR REPLACE FUNCTION get_profile_view_history(p_profile_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(view_date date, view_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    created_at::date AS view_date,
    COUNT(*)::bigint AS view_count
  FROM profile_views_log
  WHERE profile_id = p_profile_id
    AND created_at >= now() - (p_days || ' days')::interval
  GROUP BY created_at::date
  ORDER BY view_date;
$$;

-- 4. RPC: get_site_traffic
CREATE OR REPLACE FUNCTION get_site_traffic(p_days int DEFAULT 30)
RETURNS TABLE(date date, visitors bigint, page_views bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    created_at::date AS date,
    COUNT(DISTINCT user_id)::bigint AS visitors,
    COUNT(*)::bigint AS page_views
  FROM site_visits_log
  WHERE created_at >= now() - (p_days || ' days')::interval
  GROUP BY created_at::date
  ORDER BY date;
$$;

-- 5. RPC: get_profile_ranking
CREATE OR REPLACE FUNCTION get_profile_ranking(p_profile_id uuid)
RETURNS TABLE(rank bigint, total bigint, reviews_count bigint, rating numeric)
LANGUAGE sql STABLE
AS $$
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY COALESCE(rating, 0) DESC, COALESCE(reviews_count, 0) DESC)::bigint AS rank,
      COUNT(*) OVER ()::bigint AS total,
      COALESCE(reviews_count, 0)::bigint AS reviews_count,
      COALESCE(rating, 0)::numeric AS rating
    FROM profiles
    WHERE role = 'jobseeker'
  )
  SELECT rank, total, reviews_count, rating
  FROM ranked
  WHERE id = p_profile_id;
$$;
