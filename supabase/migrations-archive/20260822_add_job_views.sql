-- Job views tracking for employer dashboard
-- Run this in Supabase Dashboard SQL Editor

-- 1. Add views counter column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;

-- 2. Job views log table
CREATE TABLE IF NOT EXISTS job_views_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_views_log_job_id ON job_views_log(job_id);
CREATE INDEX IF NOT EXISTS idx_job_views_log_created_at ON job_views_log(created_at);
CREATE INDEX IF NOT EXISTS idx_job_views_log_job_created ON job_views_log(job_id, created_at);

ALTER TABLE job_views_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert job views"
  ON job_views_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Job owners can view their job view logs"
  ON job_views_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_views_log.job_id
        AND jobs.posted_by = auth.uid()
    )
  );

-- 3. RPC: increment_job_views
CREATE OR REPLACE FUNCTION increment_job_views(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE jobs SET views = COALESCE(views, 0) + 1 WHERE id = p_job_id;
END;
$$;

-- 4. RPC: get_job_view_history
CREATE OR REPLACE FUNCTION get_job_view_history(p_profile_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(view_date date, view_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    jvl.created_at::date AS view_date,
    COUNT(*)::bigint AS view_count
  FROM job_views_log jvl
  JOIN jobs j ON j.id = jvl.job_id
  WHERE j.posted_by = p_profile_id
    AND jvl.created_at >= now() - (p_days || ' days')::interval
  GROUP BY jvl.created_at::date
  ORDER BY view_date;
$$;

-- 5. RPC: get_total_job_views (sum across all employer's jobs)
CREATE OR REPLACE FUNCTION get_total_job_views(p_profile_id uuid)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(views), 0)::bigint
  FROM jobs
  WHERE posted_by = p_profile_id;
$$;

-- 6. Disable RLS on job_views_log (same pattern as profile_views_log)
ALTER TABLE job_views_log DISABLE ROW LEVEL SECURITY;

-- 7. Grant permissions
GRANT INSERT ON job_views_log TO anon, authenticated;
GRANT SELECT ON job_views_log TO authenticated;
