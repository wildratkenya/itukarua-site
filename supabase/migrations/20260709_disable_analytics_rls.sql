-- Bypass all RLS on analytics tables — data is aggregated counts only, not sensitive
-- Run this in Supabase Dashboard SQL Editor

ALTER TABLE profile_views_log DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert profile views" ON profile_views_log;
DROP POLICY IF EXISTS "Users can view their own profile view logs" ON profile_views_log;

ALTER TABLE site_visits_log DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert site visits" ON site_visits_log;
DROP POLICY IF EXISTS "Users can view their own site visits" ON site_visits_log;
