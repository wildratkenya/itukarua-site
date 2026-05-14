-- Emergency fix: Complete RLS disable for testing
-- Run this to temporarily disable all RLS and test if queries work

-- Disable RLS on all tables
ALTER TABLE "public"."jobs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."service_ads" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bids" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" DISABLE ROW LEVEL SECURITY;

-- Note: platform_stats is a view, so it inherits permissions from underlying tables
-- When you disable RLS on the underlying tables, the view should work