-- Enable RLS on all tables
ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."service_ads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- ===== PROFILES TABLE =====
-- Public read
DROP POLICY IF EXISTS "public read profiles" ON "public"."profiles";
CREATE POLICY "public read profiles" ON "public"."profiles"
FOR SELECT USING (true);

-- Authenticated users can insert their own profile
DROP POLICY IF EXISTS "auth_insert_own_profile" ON "public"."profiles";
CREATE POLICY "auth_insert_own_profile" ON "public"."profiles"
FOR INSERT WITH CHECK (auth.uid() = id);

-- Authenticated users can update their own profile
DROP POLICY IF EXISTS "auth_update_own_profile" ON "public"."profiles";
CREATE POLICY "auth_update_own_profile" ON "public"."profiles"
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Super admin can read/update all profiles
DROP POLICY IF EXISTS "admin_read_update_profiles" ON "public"."profiles";
CREATE POLICY "admin_read_update_profiles" ON "public"."profiles"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  )
);

-- ===== JOBS TABLE =====
-- Public read
DROP POLICY IF EXISTS "public read jobs" ON "public"."jobs";
CREATE POLICY "public read jobs" ON "public"."jobs"
FOR SELECT USING (status = 'open' OR status IS NULL);

-- Authenticated users can insert jobs
DROP POLICY IF EXISTS "auth_insert_jobs" ON "public"."jobs";
CREATE POLICY "auth_insert_jobs" ON "public"."jobs"
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update own jobs, admin can update all
DROP POLICY IF EXISTS "auth_update_jobs" ON "public"."jobs";
CREATE POLICY "auth_update_jobs" ON "public"."jobs"
FOR UPDATE
USING (auth.uid() = posted_by OR EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
))
WITH CHECK (auth.uid() = posted_by OR EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- ===== SERVICE_ADS TABLE =====
-- Public read
DROP POLICY IF EXISTS "public read service_ads" ON "public"."service_ads";
CREATE POLICY "public read service_ads" ON "public"."service_ads"
FOR SELECT USING (true);

-- Authenticated users can insert
DROP POLICY IF EXISTS "auth_insert_service_ads" ON "public"."service_ads";
CREATE POLICY "auth_insert_service_ads" ON "public"."service_ads"
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update own ads, admin can update all
DROP POLICY IF EXISTS "auth_update_service_ads" ON "public"."service_ads";
CREATE POLICY "auth_update_service_ads" ON "public"."service_ads"
FOR UPDATE
USING (auth.uid() = owner_id OR EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
))
WITH CHECK (auth.uid() = owner_id OR EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- ===== BIDS TABLE =====
-- Public read
DROP POLICY IF EXISTS "public read bids" ON "public"."bids";
CREATE POLICY "public read bids" ON "public"."bids"
FOR SELECT USING (true);

-- Authenticated users can insert
DROP POLICY IF EXISTS "auth_insert_bids" ON "public"."bids";
CREATE POLICY "auth_insert_bids" ON "public"."bids"
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update own bids, admin can update all
DROP POLICY IF EXISTS "auth_update_bids" ON "public"."bids";
CREATE POLICY "auth_update_bids" ON "public"."bids"
FOR UPDATE
USING (auth.uid() = bidder_id OR EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
))
WITH CHECK (auth.uid() = bidder_id OR EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- ===== PAYMENTS TABLE =====
-- Authenticated users can insert payments
DROP POLICY IF EXISTS "auth_insert_payments" ON "public"."payments";
CREATE POLICY "auth_insert_payments" ON "public"."payments"
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can read own payments, admin can read all
DROP POLICY IF EXISTS "auth_read_payments" ON "public"."payments";
CREATE POLICY "auth_read_payments" ON "public"."payments"
FOR SELECT
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- Admin can update payments
DROP POLICY IF EXISTS "admin_update_payments" ON "public"."payments";
CREATE POLICY "admin_update_payments" ON "public"."payments"
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- ===== MESSAGES TABLE =====
-- Public can insert (contact form)
DROP POLICY IF EXISTS "public_insert_messages" ON "public"."messages";
CREATE POLICY "public_insert_messages" ON "public"."messages"
FOR INSERT WITH CHECK (true);

-- Admin can read/update all messages
DROP POLICY IF EXISTS "admin_read_update_messages" ON "public"."messages";
CREATE POLICY "admin_read_update_messages" ON "public"."messages"
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));
