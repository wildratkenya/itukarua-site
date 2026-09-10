


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bids" (
    "id" "uuid" NOT NULL,
    "job_id" "uuid",
    "bidder_id" "uuid",
    "price" numeric,
    "proposal" "text",
    "status" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "profile_image" "text",
    "rating" numeric,
    "reviews_count" integer,
    "qualifications" "text",
    "experience" "text",
    "skills" "text",
    "phone" "text",
    "location" "text",
    "created_at" timestamp with time zone,
    "role" "text" DEFAULT 'jobseeker'::"text",
    "verified" boolean DEFAULT false,
    "registration_paid" boolean DEFAULT false,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."bids_with_bidder" AS
 SELECT "b"."id",
    "b"."job_id",
    "b"."bidder_id",
    "b"."price",
    "b"."proposal",
    "b"."status",
    "b"."created_at",
    "b"."updated_at",
    "p"."full_name" AS "bidder_name"
   FROM ("public"."bids" "b"
     LEFT JOIN "public"."profiles" "p" ON (("b"."bidder_id" = "p"."id")));


ALTER VIEW "public"."bids_with_bidder" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" NOT NULL,
    "title" "text",
    "description" "text",
    "budget" numeric,
    "status" "text",
    "posted_by" "uuid",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "location" "text",
    "budget_min" numeric DEFAULT 0,
    "budget_max" numeric DEFAULT 0,
    "deadline" "date",
    "category" "text",
    "posted_by_name" "text",
    "urgent" boolean DEFAULT false,
    "bids_count" integer DEFAULT 0
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."jobs_with_poster" AS
 SELECT "j"."id",
    "j"."title",
    "j"."description",
    "j"."budget",
    "j"."status",
    "j"."posted_by",
    "j"."created_at",
    "j"."updated_at",
    "p"."full_name" AS "poster_name"
   FROM ("public"."jobs" "j"
     LEFT JOIN "public"."profiles" "p" ON (("j"."posted_by" = "p"."id")));


ALTER VIEW "public"."jobs_with_poster" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "payment_type" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "mpesa_ref" "text",
    "mpesa_phone" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "description" "text",
    "related_job_id" "uuid",
    "related_ad_id" "uuid",
    "related_bid_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_ads" (
    "id" "uuid" NOT NULL,
    "title" "text",
    "description" "text",
    "price" numeric,
    "created_at" timestamp with time zone,
    "business_name" "text",
    "category" "text",
    "image" "text",
    "location" "text",
    "contact" "text",
    "plan" "text",
    "expiry_date" "date",
    "featured" boolean DEFAULT false,
    "rating" numeric DEFAULT 0,
    "reviews_count" integer DEFAULT 0,
    "owner_id" "uuid",
    "payment_confirmed" boolean DEFAULT false,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."service_ads" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."platform_stats" AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."jobs"
          WHERE ("jobs"."status" = 'open'::"text")) AS "active_jobs",
    ( SELECT "count"(*) AS "count"
           FROM "public"."profiles"
          WHERE (("profiles"."role" = 'jobseeker'::"text") AND ("profiles"."verified" = true))) AS "registered_workers",
    ( SELECT "count"(*) AS "count"
           FROM "public"."service_ads"
          WHERE ("service_ads"."expiry_date" >= CURRENT_DATE)) AS "active_businesses",
    ( SELECT "count"(*) AS "count"
           FROM "public"."jobs"
          WHERE ("jobs"."status" = 'completed'::"text")) AS "completed_jobs",
    ( SELECT COALESCE("sum"("payments"."amount"), (0)::numeric) AS "coalesce"
           FROM "public"."payments"
          WHERE ("payments"."status" = 'completed'::"text")) AS "total_payments",
    ( SELECT "count"(DISTINCT "profiles"."location") AS "count"
           FROM "public"."profiles"
          WHERE (("profiles"."location" IS NOT NULL) AND ("profiles"."location" <> ''::"text"))) AS "counties_served";


ALTER VIEW "public"."platform_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_ads"
    ADD CONSTRAINT "service_ads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_related_ad_id_fkey" FOREIGN KEY ("related_ad_id") REFERENCES "public"."service_ads"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_related_bid_id_fkey" FOREIGN KEY ("related_bid_id") REFERENCES "public"."bids"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_related_job_id_fkey" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_ads"
    ADD CONSTRAINT "service_ads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."bids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read ads" ON "public"."service_ads" FOR SELECT USING (true);



CREATE POLICY "public read bids" ON "public"."bids" FOR SELECT USING (true);



CREATE POLICY "public read jobs" ON "public"."jobs" FOR SELECT USING (true);



CREATE POLICY "public read profiles" ON "public"."profiles" FOR SELECT USING (true);



ALTER TABLE "public"."service_ads" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;







































































































































































































