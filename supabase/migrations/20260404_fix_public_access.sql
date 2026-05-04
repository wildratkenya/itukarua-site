-- Fix RLS policies for public access
-- This migration only updates policies, assuming schema already exists

-- Enable RLS on all tables (in case it's not enabled)
ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."service_ads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- ===== PROFILES TABLE =====
-- Allow public read access to all profiles
DROP POLICY IF EXISTS "public read profiles" ON "public"."profiles";
CREATE POLICY "public read profiles" ON "public"."profiles"
FOR SELECT USING (true);

-- ===== JOBS TABLE =====
-- Allow public read access to all jobs
DROP POLICY IF EXISTS "public read jobs" ON "public"."jobs";
CREATE POLICY "public read jobs" ON "public"."jobs"
FOR SELECT USING (true);

-- ===== SERVICE_ADS TABLE =====
-- Allow public read access to all service ads
DROP POLICY IF EXISTS "public read service_ads" ON "public"."service_ads";
CREATE POLICY "public read service_ads" ON "public"."service_ads"
FOR SELECT USING (true);

-- ===== BIDS TABLE =====
-- Allow public read access to all bids
DROP POLICY IF EXISTS "public read bids" ON "public"."bids";
CREATE POLICY "public read bids" ON "public"."bids"
FOR SELECT USING (true);

-- ===== MESSAGES TABLE =====
-- Public can insert messages (contact form)
DROP POLICY IF EXISTS "public_insert_messages" ON "public"."messages";
CREATE POLICY "public_insert_messages" ON "public"."messages"
FOR INSERT WITH CHECK (true);