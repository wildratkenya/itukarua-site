-- Complete SQL Script: Create missing tables and fix RLS policies
-- Run this in your Supabase SQL Editor

-- ===== CREATE MESSAGES TABLE (if it doesn't exist) =====
CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "sender_name" "text",
    "sender_email" "text",
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'support'::"text",
    "status" "text" DEFAULT 'unread'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "admin_response" "text",
    "responded_by" "uuid",
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Set ownership and constraints (only if table was just created)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'messages' AND constraint_name = 'messages_pkey') THEN
        ALTER TABLE "public"."messages" OWNER TO "postgres";
        ALTER TABLE ONLY "public"."messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");
        ALTER TABLE ONLY "public"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
        ALTER TABLE ONLY "public"."messages" ADD CONSTRAINT "messages_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- ===== ENABLE RLS ON ALL TABLES =====
ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."service_ads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- ===== DROP EXISTING POLICIES =====
-- Profiles
DROP POLICY IF EXISTS "public read profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "auth_insert_own_profile" ON "public"."profiles";
DROP POLICY IF EXISTS "auth_update_own_profile" ON "public"."profiles";
DROP POLICY IF EXISTS "admin_read_update_profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "allow_public_insert_messages" ON "public"."messages";
DROP POLICY IF EXISTS "allow_admin_read_messages" ON "public"."messages";
DROP POLICY IF EXISTS "allow_admin_update_messages" ON "public"."messages";

-- Jobs
DROP POLICY IF EXISTS "public read jobs" ON "public"."jobs";
DROP POLICY IF EXISTS "auth_insert_jobs" ON "public"."jobs";
DROP POLICY IF EXISTS "auth_update_jobs" ON "public"."jobs";

-- Service Ads
DROP POLICY IF EXISTS "public read service_ads" ON "public"."service_ads";
DROP POLICY IF EXISTS "auth_insert_service_ads" ON "public"."service_ads";
DROP POLICY IF EXISTS "auth_update_service_ads" ON "public"."service_ads";

-- Bids
DROP POLICY IF EXISTS "public read bids" ON "public"."bids";
DROP POLICY IF EXISTS "auth_insert_bids" ON "public"."bids";
DROP POLICY IF EXISTS "auth_update_bids" ON "public"."bids";

-- Payments
DROP POLICY IF EXISTS "auth_insert_payments" ON "public"."payments";
DROP POLICY IF EXISTS "auth_read_payments" ON "public"."payments";
DROP POLICY IF EXISTS "admin_update_payments" ON "public"."payments";
DROP POLICY IF EXISTS "public_read_payments" ON "public"."payments";

-- Messages
DROP POLICY IF EXISTS "public_insert_messages" ON "public"."messages";
DROP POLICY IF EXISTS "admin_read_update_messages" ON "public"."messages";

-- ===== CREATE NEW POLICIES =====

-- PROFILES: Public read, authenticated write
CREATE POLICY "public read profiles" ON "public"."profiles" FOR SELECT USING (true);
CREATE POLICY "auth_insert_own_profile" ON "public"."profiles" FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "auth_update_own_profile" ON "public"."profiles" FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admin_read_update_profiles" ON "public"."profiles" FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

-- JOBS: Public read, authenticated write
CREATE POLICY "public read jobs" ON "public"."jobs" FOR SELECT USING (true);
CREATE POLICY "auth_insert_jobs" ON "public"."jobs" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_jobs" ON "public"."jobs" FOR UPDATE USING (auth.uid() = posted_by OR EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
)) WITH CHECK (auth.uid() = posted_by OR EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- SERVICE_ADS: Public read, authenticated write
CREATE POLICY "public read service_ads" ON "public"."service_ads" FOR SELECT USING (true);
CREATE POLICY "auth_insert_service_ads" ON "public"."service_ads" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_service_ads" ON "public"."service_ads" FOR UPDATE USING (auth.uid() = owner_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
)) WITH CHECK (auth.uid() = owner_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- BIDS: Public read, authenticated write
CREATE POLICY "public read bids" ON "public"."bids" FOR SELECT USING (true);
CREATE POLICY "auth_insert_bids" ON "public"."bids" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_bids" ON "public"."bids" FOR UPDATE USING (auth.uid() = bidder_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
)) WITH CHECK (auth.uid() = bidder_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- PAYMENTS: Public read (for stats), authenticated write
CREATE POLICY "public_read_payments" ON "public"."payments" FOR SELECT USING (true);
CREATE POLICY "auth_insert_payments" ON "public"."payments" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_update_payments" ON "public"."payments" FOR UPDATE USING (EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
)) WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));

-- MESSAGES: Public insert, admin read/update
CREATE POLICY "public_insert_messages" ON "public"."messages" FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_read_update_messages" ON "public"."messages" FOR ALL USING (EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
));