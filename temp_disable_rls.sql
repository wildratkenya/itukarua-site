-- Temporary test: Disable RLS to verify the issue
-- Run this in Supabase SQL Editor to temporarily disable RLS

-- Temporarily disable RLS on key tables for testing
ALTER TABLE "public"."jobs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."service_ads" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."platform_stats" DISABLE ROW LEVEL SECURITY;

-- Test if queries work now
-- If this fixes the 401 errors, then RLS policies are the problem