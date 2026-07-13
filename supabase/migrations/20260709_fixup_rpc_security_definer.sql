-- Make analytics RPCs bypass RLS (SECURITY DEFINER) so authenticated users can see their data
-- Run this in Supabase Dashboard SQL Editor

CREATE OR REPLACE FUNCTION get_profile_view_history(p_profile_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(view_date date, view_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION get_site_traffic(p_days int DEFAULT 30)
RETURNS TABLE(date date, visitors bigint, page_views bigint)
LANGUAGE sql STABLE SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION get_profile_ranking(p_profile_id uuid)
RETURNS TABLE(rank bigint, total bigint, reviews_count bigint, rating numeric)
LANGUAGE sql STABLE SECURITY DEFINER
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
