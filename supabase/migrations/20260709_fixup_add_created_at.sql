-- Fixup: add missing columns to analytics tables (safe to re-run)
-- Run this in Supabase Dashboard SQL Editor

DO $$
BEGIN
  -- profile_views_log
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profile_views_log') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profile_views_log' AND column_name = 'viewer_id') THEN
      ALTER TABLE profile_views_log ADD COLUMN viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profile_views_log' AND column_name = 'created_at') THEN
      ALTER TABLE profile_views_log ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profile_views_log' AND column_name = 'profile_id') THEN
      ALTER TABLE profile_views_log ADD COLUMN profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- site_visits_log
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'site_visits_log') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'site_visits_log' AND column_name = 'user_id') THEN
      ALTER TABLE site_visits_log ADD COLUMN user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'site_visits_log' AND column_name = 'page_path') THEN
      ALTER TABLE site_visits_log ADD COLUMN page_path text NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'site_visits_log' AND column_name = 'created_at') THEN
      ALTER TABLE site_visits_log ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Re-create RPCs (may have failed if columns were missing)
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
