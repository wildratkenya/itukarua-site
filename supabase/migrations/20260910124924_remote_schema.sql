


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


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."admin_newsletter"("action" "text", "p_email" "text" DEFAULT NULL::"text", "p_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSONB;
BEGIN
  IF action = 'list' THEN
    SELECT jsonb_agg(jsonb_build_object('email', email, 'name', name, 'created_at', created_at) ORDER BY created_at DESC) INTO result FROM newsletter_subscribers;
    RETURN COALESCE(result, '[]'::jsonb);
  ELSIF action = 'add' THEN
    INSERT INTO newsletter_subscribers (email, name) VALUES (p_email, COALESCE(p_name, ''));
    RETURN '"ok"'::jsonb;
  ELSIF action = 'delete' THEN
    DELETE FROM newsletter_subscribers WHERE email = p_email;
    RETURN '"ok"'::jsonb;
  END IF;
  RETURN '"unknown action"'::jsonb;
END;
$$;


ALTER FUNCTION "public"."admin_newsletter"("action" "text", "p_email" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_reset_password"("p_user_id" "uuid", "p_new_password" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super_admins can reset passwords';
  END IF;
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found in auth.users'; END IF;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."admin_reset_password"("p_user_id" "uuid", "p_new_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_visitor_impressions"("p_ad_id" "uuid", "p_visitor_id" "text", "p_days" integer DEFAULT 7) RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$SELECT COUNT(*)::integer FROM public.ad_impressions WHERE ad_id = p_ad_id AND visitor_id = p_visitor_id AND served_at >= now() - (p_days || ' days')::interval;$$;


ALTER FUNCTION "public"."count_visitor_impressions"("p_ad_id" "uuid", "p_visitor_id" "text", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"("p_id" "uuid", "p_full_name" "text", "p_email" "text", "p_phone" "text", "p_role" "text", "p_location" "text", "p_skills" "text", "p_resume" "text", "p_county" "text" DEFAULT NULL::"text", "p_subcounty" "text" DEFAULT NULL::"text", "p_profile_image" "text" DEFAULT NULL::"text", "p_ratings_enabled" boolean DEFAULT NULL::boolean, "p_terms_accepted" boolean DEFAULT false, "p_data_sharing_consent" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, location, county, subcounty, skills, resume, profile_image, ratings_enabled, verified, registration_paid, terms_accepted, data_sharing_consent, accepted_terms_at)
  VALUES (p_id, p_full_name, p_email, p_phone, p_role, p_location, p_county, p_subcounty, p_skills, p_resume, COALESCE(p_profile_image, ''), COALESCE(p_ratings_enabled, false), true, true, p_terms_accepted, p_data_sharing_consent, CASE WHEN p_terms_accepted THEN now() ELSE NULL END)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    location = EXCLUDED.location,
    county = EXCLUDED.county,
    subcounty = EXCLUDED.subcounty,
    skills = EXCLUDED.skills,
    resume = EXCLUDED.resume,
    profile_image = CASE WHEN p_profile_image IS NOT NULL THEN p_profile_image ELSE profiles.profile_image END,
    ratings_enabled = CASE WHEN p_ratings_enabled IS NOT NULL THEN p_ratings_enabled ELSE profiles.ratings_enabled END,
    terms_accepted = CASE WHEN p_terms_accepted THEN true ELSE profiles.terms_accepted END,
    data_sharing_consent = CASE WHEN p_data_sharing_consent THEN true ELSE profiles.data_sharing_consent END,
    accepted_terms_at = CASE WHEN p_terms_accepted AND NOT profiles.terms_accepted THEN now() ELSE profiles.accepted_terms_at END,
    verified = true,
    registration_paid = true;
  RETURN p_id;
END;
$$;


ALTER FUNCTION "public"."create_user_profile"("p_id" "uuid", "p_full_name" "text", "p_email" "text", "p_phone" "text", "p_role" "text", "p_location" "text", "p_skills" "text", "p_resume" "text", "p_county" "text", "p_subcounty" "text", "p_profile_image" "text", "p_ratings_enabled" boolean, "p_terms_accepted" boolean, "p_data_sharing_consent" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_delivery_pace"("p_ad_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$WITH ad_info AS (SELECT billing_start, billing_end, COALESCE(expected_impressions, 1000) AS expected_total FROM advertisements WHERE id = p_ad_id), elapsed AS (SELECT GREATEST(EXTRACT(EPOCH FROM (now() - billing_start)) / GREATEST(EXTRACT(EPOCH FROM (billing_end - billing_start)), 1), 0.01) AS fraction_elapsed, expected_total FROM ad_info), actual AS (SELECT COUNT(*)::numeric AS cnt FROM ad_impressions WHERE ad_id = p_ad_id AND served_at >= (SELECT billing_start FROM ad_info)) SELECT CASE WHEN (SELECT fraction_elapsed FROM elapsed) <= 0 THEN 1.0 ELSE (SELECT cnt FROM actual) / ((SELECT fraction_elapsed FROM elapsed) * (SELECT expected_total FROM elapsed)) END;$$;


ALTER FUNCTION "public"."get_delivery_pace"("p_ad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_impressions_by_county"("p_ad_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("county" "text", "impressions" bigint)
    LANGUAGE "sql" STABLE
    AS $$SELECT COALESCE(ai.county, 'Unknown') AS county, COUNT(*) AS impressions FROM ad_impressions ai WHERE ai.ad_id = p_ad_id AND ai.served_at >= now() - (p_days || ' days')::interval GROUP BY COALESCE(ai.county, 'Unknown') ORDER BY impressions DESC;$$;


ALTER FUNCTION "public"."get_impressions_by_county"("p_ad_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_job_view_history"("p_profile_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("view_date" "date", "view_count" bigint)
    LANGUAGE "sql" STABLE
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


ALTER FUNCTION "public"."get_job_view_history"("p_profile_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_newsletter_subscriber_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::integer FROM public.newsletter_subscribers;
$$;


ALTER FUNCTION "public"."get_newsletter_subscriber_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_ranking"("p_profile_id" "uuid") RETURNS TABLE("rank" bigint, "total" bigint, "reviews_count" bigint, "rating" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
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
  WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_profile_ranking"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_view_history"("p_profile_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("view_date" "date", "view_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    created_at::date AS view_date,
    COUNT(*)::bigint AS view_count
  FROM profile_views_log
  WHERE profile_id = auth.uid()
    AND created_at >= now() - (p_days || ' days')::interval
  GROUP BY created_at::date
  ORDER BY view_date;
$$;


ALTER FUNCTION "public"."get_profile_view_history"("p_profile_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_site_traffic"("p_days" integer DEFAULT 30) RETURNS TABLE("date" "date", "visitors" bigint, "page_views" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    created_at::date AS date,
    COUNT(DISTINCT user_id)::bigint AS visitors,
    COUNT(*)::bigint AS page_views
  FROM site_visits_log
  WHERE user_id = auth.uid()
    AND created_at >= now() - (p_days || ' days')::interval
  GROUP BY created_at::date
  ORDER BY date;
$$;


ALTER FUNCTION "public"."get_site_traffic"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_job_views"("p_profile_id" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(SUM(views), 0)::bigint
  FROM jobs
  WHERE posted_by = p_profile_id;
$$;


ALTER FUNCTION "public"."get_total_job_views"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_bid_accepted_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    INSERT INTO public.notifications (user_id, type, title, body, related_link)
    SELECT NEW.bidder_id, 'bid_accepted', 'Bid Accepted!',
      'Your bid has been accepted for job "' || j.title || '"',
      '/job/' || NEW.job_id
    FROM public.jobs j WHERE j.id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_bid_accepted_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_bid_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, related_link)
  SELECT j.posted_by, 'new_bid', 'New Bid Received',
    'A new bid has been placed on your job "' || j.title || '"',
    '/job/' || NEW.job_id
  FROM public.jobs j WHERE j.id = NEW.job_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_bid_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_direct_message_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, related_link)
  SELECT cp.user_id, 'new_message', 'New Message',
    'You have a new message',
    '/inbox'
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id != NEW.sender_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_direct_message_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ad_click"("ad_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN UPDATE advertisements SET clicks = clicks + 1 WHERE id = ad_id; END; $$;


ALTER FUNCTION "public"."increment_ad_click"("ad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ad_display"("ad_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN UPDATE advertisements SET display_count = display_count + 1 WHERE id = ad_id; END; $$;


ALTER FUNCTION "public"."increment_ad_display"("ad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_job_views"("p_job_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE jobs SET views = COALESCE(views, 0) + 1 WHERE id = p_job_id;
END;
$$;


ALTER FUNCTION "public"."increment_job_views"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_profile_views"("p_profile_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE profiles SET profile_views = COALESCE(profile_views, 0) + 1 WHERE id = p_profile_id;
  INSERT INTO profile_views_log (profile_id) VALUES (p_profile_id);
END;
$$;


ALTER FUNCTION "public"."increment_profile_views"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_corporate_member"("p_account_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_members cm
    WHERE cm.account_id = p_account_id
      AND cm.profile_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_corporate_member"("p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_corporate_owner"("p_account_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_members cm
    WHERE cm.account_id = p_account_id
      AND cm.profile_id = auth.uid()
      AND cm.member_role = 'owner'
  );
$$;


ALTER FUNCTION "public"."is_corporate_owner"("p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."newsletter_subscribe"("p_email" "text", "p_name" "text" DEFAULT ''::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_email text := lower(p_email);
  v_domain text;
  v_hour_ago timestamptz := now() - interval '1 hour';
  v_recent integer;
BEGIN
  -- Format basics.
  IF v_email IS NULL OR v_email = ''
     OR length(v_email) > 254
     OR position('@' in v_email) <= 1
  THEN
    RETURN 'Invalid email';
  END IF;
  v_domain := substring(v_email from position('@' in v_email) + 1);
  IF v_domain = ''
     OR v_domain !~ '^[a-z0-9.-]+\.[a-z]{2,63}$'
     OR v_domain ~* '(^|\.)(local|internal|invalid|test|example|fake)(\.|$)'
  THEN
    RETURN 'Invalid email';
  END IF;

  -- Reject role accounts (admin@, info@, ...).
  IF v_email ~* '^(admin|info|support|contact|sales|helpdesk|help|office|webmaster|postmaster|hostmaster|noreply|no-reply|mailer|root|security|billing|accounts|team|hello|test|temp|mail|spam|reviews)@'
  THEN
    RETURN 'Invalid email';
  END IF;

  -- Reject well-known disposable/temporary domains.
  IF v_email ~ '@([a-z0-9-]*\.)*(mailinator|guerrillamail|yopmail|temp-mail|tempmail|10minutemail|10mail|trashmail|maildrop|dispostable|throwawaymail|mailnesia|shutcmail|getnada|emailondeck|0-mail|maileater|mailcatch|mintemail|spamgourmet|fakeinbox|dropmail|mytemp|emailias|pokemail|telegmail|dumpmail|jetable|meltmail|spamfree24)\.'
  THEN
    RETURN 'Invalid email';
  END IF;

  -- Rate limit: at most 3 subscribe attempts per email within any hour.
  SELECT count(*) INTO v_recent
    FROM public.newsletter_subscribers
   WHERE lower(email) = v_email
     AND created_at >= v_hour_ago;
  IF v_recent >= 3 THEN
    RETURN 'Too many attempts. Please try again later.';
  END IF;

  BEGIN
    INSERT INTO public.newsletter_subscribers (email, name)
    VALUES (v_email, p_name);
  EXCEPTION WHEN unique_violation THEN
    RETURN 'This email is already subscribed.';
  END;

  RETURN '';
END;
$_$;


ALTER FUNCTION "public"."newsletter_subscribe"("p_email" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_corporate_accounts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_corporate_accounts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.profiles
    SET 
        rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM public.profile_reviews WHERE profile_id = COALESCE(NEW.profile_id, OLD.profile_id)), 0),
        reviews_count = COALESCE((SELECT COUNT(*) FROM public.profile_reviews WHERE profile_id = COALESCE(NEW.profile_id, OLD.profile_id)), 0)
    WHERE id = COALESCE(NEW.profile_id, OLD.profile_id);
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_profile_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_vote_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    target_id UUID;
BEGIN
    target_id := COALESCE(NEW.profile_id, OLD.profile_id);
    UPDATE public.profiles
    SET
        likes_count = COALESCE((SELECT COUNT(*) FROM public.profile_votes WHERE profile_id = target_id AND vote_type = 'up'), 0),
        dislikes_count = COALESCE((SELECT COUNT(*) FROM public.profile_votes WHERE profile_id = target_id AND vote_type = 'down'), 0)
    WHERE id = target_id;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_profile_vote_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_service_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE "public"."service_ads"
    SET 
        rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM "public"."service_ratings" WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)), 0),
        reviews_count = COALESCE((SELECT COUNT(*) FROM "public"."service_ratings" WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)), 0)
    WHERE id = COALESCE(NEW.service_id, OLD.service_id);
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_service_rating"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ad_carousel_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ad_carousel_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ad_impressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ad_id" "uuid" NOT NULL,
    "visitor_id" "text" NOT NULL,
    "county" "text",
    "subcounty" "text",
    "served_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ad_impressions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advert_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ad_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "advert_analytics_event_type_check" CHECK (("event_type" = ANY (ARRAY['click'::"text", 'impression'::"text"])))
);


ALTER TABLE "public"."advert_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advert_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "package" "text" DEFAULT 'bronze'::"text" NOT NULL,
    "start_date" "date",
    "message" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."advert_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advertisements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "destination_url" "text",
    "is_affiliate" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "cta_text" "text" DEFAULT 'Learn More'::"text",
    "clicks" integer DEFAULT 0,
    "display_count" integer DEFAULT 0,
    "whatsapp_number" "text",
    "owner_id" "uuid",
    "featured" boolean DEFAULT false,
    "billing_cycle" "text",
    "billing_start" timestamp with time zone,
    "billing_end" timestamp with time zone,
    "last_invoice_at" timestamp with time zone,
    "owner_email" "text",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "boost_until" timestamp with time zone,
    "slot" "text" DEFAULT 'homepage_banner'::"text",
    "target_county" "text",
    "target_subcounty" "text",
    "expected_impressions" integer,
    "corporate_tier" "text",
    "corporate_account_id" "uuid"
);


ALTER TABLE "public"."advertisements" OWNER TO "postgres";


COMMENT ON COLUMN "public"."advertisements"."corporate_tier" IS 'bronze|silver|gold|custom — set for corporate/admin-created placements';



CREATE TABLE IF NOT EXISTS "public"."bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "bidder_id" "uuid",
    "price" numeric,
    "proposal" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
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
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'jobseeker'::"text",
    "verified" boolean DEFAULT false,
    "registration_paid" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "suspended" boolean DEFAULT false,
    "email" "text",
    "resume" "text",
    "certificates" "text"[] DEFAULT '{}'::"text"[],
    "ratings_enabled" boolean DEFAULT false,
    "terms_accepted" boolean DEFAULT false,
    "data_sharing_consent" boolean DEFAULT false,
    "accepted_terms_at" timestamp with time zone,
    "subscription_expires_at" timestamp with time zone,
    "county" "text",
    "subcounty" "text",
    "profile_views" integer DEFAULT 0,
    "likes_count" integer DEFAULT 0 NOT NULL,
    "dislikes_count" integer DEFAULT 0 NOT NULL,
    "whatsapp_number" "text",
    "is_featured" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."bids_with_bidder" WITH ("security_invoker"='true') AS
 SELECT "b"."id",
    "b"."job_id",
    "b"."bidder_id",
    "b"."price",
    "b"."proposal",
    "b"."status",
    "b"."created_at",
    "b"."updated_at",
    "p"."full_name" AS "bidder_name",
    "p"."profile_image" AS "bidder_image",
    "p"."rating" AS "bidder_rating",
    "p"."reviews_count" AS "bidder_reviews",
    "p"."qualifications" AS "bidder_qualifications",
    "p"."experience" AS "bidder_experience",
    "p"."skills" AS "bidder_skills",
    "p"."phone" AS "bidder_phone",
    "p"."location" AS "bidder_location",
    "p"."county" AS "bidder_county",
    "p"."subcounty" AS "bidder_subcounty"
   FROM ("public"."bids" "b"
     LEFT JOIN "public"."profiles" "p" ON (("b"."bidder_id" = "p"."id")));


ALTER VIEW "public"."bids_with_bidder" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "business_name" "text",
    "recipient_email" "text" NOT NULL,
    "subject" "text",
    "amount" numeric,
    "due_date" "date",
    "status" "text" DEFAULT 'sent'::"text",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."corporate_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "contact_person" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "billing_email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "features" "jsonb",
    CONSTRAINT "corporate_accounts_tier_check" CHECK (("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."corporate_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."corporate_accounts"."features" IS 'Custom bundle: { ids: string[], placements: int, team_seats: int }. NULL = fixed tier defaults.';



CREATE TABLE IF NOT EXISTS "public"."corporate_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "member_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "corporate_members_member_role_check" CHECK (("member_role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."corporate_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."corporate_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "otp_code" "text" NOT NULL,
    "signup_data" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."corporate_signups" OWNER TO "postgres";


COMMENT ON TABLE "public"."corporate_signups" IS 'Pending corporate self-service signups, keyed by email + OTP code. Records are one-time use.';



CREATE TABLE IF NOT EXISTS "public"."custom_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "custom_categories_type_check" CHECK (("type" = ANY (ARRAY['job'::"text", 'service'::"text"])))
);


ALTER TABLE "public"."custom_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."direct_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "username" "text" NOT NULL,
    "password" "text" NOT NULL,
    "imap_host" "text",
    "imap_port" integer DEFAULT 993,
    "smtp_host" "text" NOT NULL,
    "smtp_port" integer DEFAULT 465,
    "from_name" "text",
    "from_email" "text",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "otp_code" "text" NOT NULL,
    "job_data" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_otps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_views_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_views_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "budget" numeric,
    "status" "text",
    "posted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "location" "text",
    "budget_min" numeric DEFAULT 0,
    "budget_max" numeric DEFAULT 0,
    "deadline" "date",
    "category" "text",
    "posted_by_name" "text",
    "urgent" boolean DEFAULT false,
    "bids_count" integer DEFAULT 0,
    "images" "text"[] DEFAULT '{}'::"text"[],
    "county" "text",
    "subcounty" "text",
    "views" integer DEFAULT 0
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."jobs_with_poster" WITH ("security_invoker"='true') AS
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
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "conversation_id" "uuid",
    "role" "text" DEFAULT 'user'::"text"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "related_link" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "checkout_request_id" "text",
    "related_profile_id" "uuid",
    "token" "text"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_ads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "price" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
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
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "images" "text"[] DEFAULT '{}'::"text"[],
    "contact_person" "text",
    "county" "text",
    "subcounty" "text",
    "billing_cycle" "text",
    "billing_start" timestamp with time zone,
    "billing_end" timestamp with time zone,
    "last_invoice_at" timestamp with time zone,
    "owner_email" "text",
    "boost_until" timestamp with time zone
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


CREATE TABLE IF NOT EXISTS "public"."portfolio_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "url" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."portfolio_sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "job_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profile_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."profile_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_views_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "viewer_id" "uuid"
);


ALTER TABLE "public"."profile_views_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "voter_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "vote_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profile_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY['up'::"text", 'down'::"text"])))
);


ALTER TABLE "public"."profile_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "bidder_id" "uuid",
    "poster_id" "uuid",
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "service_ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."service_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_visits_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "page_path" "text",
    "visited_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_visits_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_name" "text" NOT NULL,
    "company" "text",
    "comment" "text" NOT NULL,
    "rating" integer DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "testimonials_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."testimonials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ad_carousel_settings"
    ADD CONSTRAINT "ad_carousel_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."ad_impressions"
    ADD CONSTRAINT "ad_impressions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advert_analytics"
    ADD CONSTRAINT "advert_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advert_leads"
    ADD CONSTRAINT "advert_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advertisements"
    ADD CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_notifications"
    ADD CONSTRAINT "billing_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corporate_accounts"
    ADD CONSTRAINT "corporate_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corporate_members"
    ADD CONSTRAINT "corporate_members_account_id_profile_id_key" UNIQUE ("account_id", "profile_id");



ALTER TABLE ONLY "public"."corporate_members"
    ADD CONSTRAINT "corporate_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corporate_signups"
    ADD CONSTRAINT "corporate_signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_name_type_key" UNIQUE ("name", "type");



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_providers"
    ADD CONSTRAINT "email_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_otps"
    ADD CONSTRAINT "job_otps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_views_log"
    ADD CONSTRAINT "job_views_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."portfolio_sites"
    ADD CONSTRAINT "portfolio_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_reviews"
    ADD CONSTRAINT "profile_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_reviews"
    ADD CONSTRAINT "profile_reviews_reviewer_id_profile_id_key" UNIQUE ("reviewer_id", "profile_id");



ALTER TABLE ONLY "public"."profile_views_log"
    ADD CONSTRAINT "profile_views_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_votes"
    ADD CONSTRAINT "profile_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_votes"
    ADD CONSTRAINT "profile_votes_voter_id_profile_id_key" UNIQUE ("voter_id", "profile_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_ads"
    ADD CONSTRAINT "service_ads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_ratings"
    ADD CONSTRAINT "service_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_ratings"
    ADD CONSTRAINT "service_ratings_service_id_user_id_key" UNIQUE ("service_id", "user_id");



ALTER TABLE ONLY "public"."site_visits_log"
    ADD CONSTRAINT "site_visits_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ad_impressions_ad_served" ON "public"."ad_impressions" USING "btree" ("ad_id", "served_at");



CREATE INDEX "idx_ad_impressions_ad_visitor" ON "public"."ad_impressions" USING "btree" ("ad_id", "visitor_id");



CREATE INDEX "idx_ad_impressions_visitor_served" ON "public"."ad_impressions" USING "btree" ("visitor_id", "served_at");



CREATE INDEX "idx_advert_analytics_ad_date" ON "public"."advert_analytics" USING "btree" ("ad_id", "created_at");



CREATE INDEX "idx_advert_analytics_ad_id" ON "public"."advert_analytics" USING "btree" ("ad_id");



CREATE INDEX "idx_advert_analytics_created_at" ON "public"."advert_analytics" USING "btree" ("created_at");



CREATE INDEX "idx_advert_leads_status" ON "public"."advert_leads" USING "btree" ("status", "created_at");



CREATE INDEX "idx_advertisements_corporate" ON "public"."advertisements" USING "btree" ("corporate_account_id");



CREATE INDEX "idx_advertisements_slot_active" ON "public"."advertisements" USING "btree" ("slot", "active");



CREATE INDEX "idx_advertisements_target" ON "public"."advertisements" USING "btree" ("target_county", "target_subcounty", "slot", "active");



CREATE INDEX "idx_corporate_signups_email" ON "public"."corporate_signups" USING "btree" ("email");



CREATE INDEX "idx_job_otps_expires" ON "public"."job_otps" USING "btree" ("expires_at");



CREATE INDEX "idx_job_otps_user_email" ON "public"."job_otps" USING "btree" ("user_id", "email", "used");



CREATE INDEX "idx_job_views_log_created_at" ON "public"."job_views_log" USING "btree" ("created_at");



CREATE INDEX "idx_job_views_log_job_created" ON "public"."job_views_log" USING "btree" ("job_id", "created_at");



CREATE INDEX "idx_job_views_log_job_id" ON "public"."job_views_log" USING "btree" ("job_id");



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_payments_checkout_request" ON "public"."payments" USING "btree" ("checkout_request_id");



CREATE INDEX "idx_payments_contact_access" ON "public"."payments" USING "btree" ("user_id", "payment_type", "related_profile_id") WHERE (("payment_type" = 'contact_access'::"text") AND ("status" = 'completed'::"text"));



CREATE INDEX "idx_profile_votes_profile" ON "public"."profile_votes" USING "btree" ("profile_id");



CREATE INDEX "idx_pvl_profile_id" ON "public"."profile_views_log" USING "btree" ("profile_id");



CREATE INDEX "idx_pvl_viewed_at" ON "public"."profile_views_log" USING "btree" ("viewed_at");



CREATE INDEX "idx_svl_visited_at" ON "public"."site_visits_log" USING "btree" ("visited_at");



CREATE UNIQUE INDEX "newsletter_subscribers_email_lower_key" ON "public"."newsletter_subscribers" USING "btree" ("lower"("email"));



CREATE INDEX "ratings_bidder_id_idx" ON "public"."ratings" USING "btree" ("bidder_id");



CREATE INDEX "ratings_job_id_idx" ON "public"."ratings" USING "btree" ("job_id");



CREATE OR REPLACE TRIGGER "corporate_accounts_updated_at" BEFORE UPDATE ON "public"."corporate_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_corporate_accounts_updated_at"();



CREATE OR REPLACE TRIGGER "on_bid_insert" AFTER INSERT ON "public"."bids" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_bid_notification"();



CREATE OR REPLACE TRIGGER "on_bid_update" AFTER UPDATE ON "public"."bids" FOR EACH ROW EXECUTE FUNCTION "public"."handle_bid_accepted_notification"();



CREATE OR REPLACE TRIGGER "on_direct_message_insert" AFTER INSERT ON "public"."direct_messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_direct_message_notification"();



CREATE OR REPLACE TRIGGER "trigger_update_profile_rating" AFTER INSERT OR DELETE ON "public"."profile_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_rating"();



CREATE OR REPLACE TRIGGER "trigger_update_profile_vote_counts" AFTER INSERT OR DELETE OR UPDATE ON "public"."profile_votes" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_vote_counts"();



CREATE OR REPLACE TRIGGER "trigger_update_service_rating" AFTER INSERT OR DELETE ON "public"."service_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."update_service_rating"();



CREATE OR REPLACE TRIGGER "update_profile_rating_trigger" AFTER INSERT ON "public"."ratings" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_rating"();



ALTER TABLE ONLY "public"."ad_impressions"
    ADD CONSTRAINT "ad_impressions_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."advertisements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advert_analytics"
    ADD CONSTRAINT "advert_analytics_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."advertisements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advertisements"
    ADD CONSTRAINT "advertisements_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "public"."corporate_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."advertisements"
    ADD CONSTRAINT "advertisements_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."corporate_members"
    ADD CONSTRAINT "corporate_members_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."corporate_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."corporate_members"
    ADD CONSTRAINT "corporate_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_otps"
    ADD CONSTRAINT "job_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_views_log"
    ADD CONSTRAINT "job_views_log_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_related_bid_id_fkey" FOREIGN KEY ("related_bid_id") REFERENCES "public"."bids"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_related_job_id_fkey" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_related_profile_id_fkey" FOREIGN KEY ("related_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_reviews"
    ADD CONSTRAINT "profile_reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_reviews"
    ADD CONSTRAINT "profile_reviews_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_reviews"
    ADD CONSTRAINT "profile_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_views_log"
    ADD CONSTRAINT "profile_views_log_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_views_log"
    ADD CONSTRAINT "profile_views_log_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_votes"
    ADD CONSTRAINT "profile_votes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_votes"
    ADD CONSTRAINT "profile_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_poster_id_fkey" FOREIGN KEY ("poster_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_ads"
    ADD CONSTRAINT "service_ads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."service_ratings"
    ADD CONSTRAINT "service_ratings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."service_ads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_ratings"
    ADD CONSTRAINT "service_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."site_visits_log"
    ADD CONSTRAINT "site_visits_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage ads" ON "public"."advertisements" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Admins manage categories" ON "public"."custom_categories" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))));



CREATE POLICY "Advertisers can manage own ads" ON "public"."advertisements" USING (("owner_id" = "auth"."uid"())) WITH CHECK ((("owner_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'advertiser'::"text"))))));



CREATE POLICY "All users can read categories" ON "public"."custom_categories" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can insert job views" ON "public"."job_views_log" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can read ratings" ON "public"."ratings" FOR SELECT USING (true);



CREATE POLICY "Anyone can subscribe" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (("email" ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,63}$'::"text"));



CREATE POLICY "Anyone can view active ads" ON "public"."advertisements" FOR SELECT USING (("active" = true));



CREATE POLICY "Authenticated users can view subscribers" ON "public"."newsletter_subscribers" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Job owners can view their job view logs" ON "public"."job_views_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "job_views_log"."job_id") AND ("jobs"."posted_by" = "auth"."uid"())))));



CREATE POLICY "Service role full access on job_otps" ON "public"."job_otps" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create ratings" ON "public"."ratings" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can update own ratings" ON "public"."ratings" FOR UPDATE USING (("auth"."uid"() = "poster_id"));



ALTER TABLE "public"."ad_carousel_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ad_impressions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin insert platform_settings" ON "public"."platform_settings" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "admin update ad_carousel_settings" ON "public"."ad_carousel_settings" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "admin update platform_settings" ON "public"."platform_settings" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "admin write portfolio_sites" ON "public"."portfolio_sites" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "admin write testimonials" ON "public"."testimonials" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "admin_all_ads" ON "public"."service_ads" TO "authenticated" USING ((("auth"."uid"() = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))))) WITH CHECK ((("auth"."uid"() = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))));



CREATE POLICY "admin_all_jobs" ON "public"."jobs" TO "authenticated" USING ((("auth"."uid"() = "posted_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))))) WITH CHECK ((("auth"."uid"() = "posted_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))));



CREATE POLICY "admin_delete_profiles" ON "public"."profiles" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "admin_read_update_messages" ON "public"."messages" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "admin_update_payments" ON "public"."payments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "admin_update_profiles" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"])))))));



CREATE POLICY "admins manage impressions" ON "public"."ad_impressions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "admins write billing_notifications" ON "public"."billing_notifications" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "admins_read_all_views" ON "public"."profile_views_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



ALTER TABLE "public"."advert_analytics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "advert_analytics_insert_anon" ON "public"."advert_analytics" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "advert_analytics_insert_auth" ON "public"."advert_analytics" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "advert_analytics_select_public" ON "public"."advert_analytics" FOR SELECT USING (true);



ALTER TABLE "public"."advert_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."advertisements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon can insert impressions" ON "public"."ad_impressions" FOR INSERT WITH CHECK (true);



CREATE POLICY "anyone_insert_views" ON "public"."profile_views_log" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "anyone_insert_visits" ON "public"."site_visits_log" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "auth insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth insert participants" ON "public"."conversation_participants" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_delete_jobs" ON "public"."jobs" FOR DELETE USING ((("auth"."uid"() = "posted_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))));



CREATE POLICY "auth_delete_service_ads" ON "public"."service_ads" FOR DELETE USING ((("auth"."uid"() = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))));



CREATE POLICY "auth_insert_bids" ON "public"."bids" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "auth_insert_jobs" ON "public"."jobs" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "auth_insert_own_profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "auth_insert_payments" ON "public"."payments" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "auth_insert_service_ads" ON "public"."service_ads" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "auth_update_bids" ON "public"."bids" FOR UPDATE USING ((("auth"."uid"() = "bidder_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))))) WITH CHECK ((("auth"."uid"() = "bidder_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))));



CREATE POLICY "auth_update_jobs" ON "public"."jobs" FOR UPDATE USING ((("auth"."uid"() = "posted_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))))) WITH CHECK ((("auth"."uid"() = "posted_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))));



CREATE POLICY "auth_update_own_profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "auth_update_service_ads" ON "public"."service_ads" FOR UPDATE USING ((("auth"."uid"() = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))))) WITH CHECK ((("auth"."uid"() = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))));



CREATE POLICY "authenticated insert profile_reviews" ON "public"."profile_reviews" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated insert profile_votes" ON "public"."profile_votes" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND ("auth"."uid"() = "voter_id")));



CREATE POLICY "authenticated insert ratings" ON "public"."ratings" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated insert service_ratings" ON "public"."service_ratings" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated_read_all_visits" ON "public"."site_visits_log" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "corporate members insert own ads" ON "public"."advertisements" FOR INSERT WITH CHECK ((("corporate_account_id" IS NOT NULL) AND "public"."is_corporate_member"("corporate_account_id")));



CREATE POLICY "corporate members manage own ads" ON "public"."advertisements" FOR UPDATE USING ((("corporate_account_id" IS NOT NULL) AND "public"."is_corporate_member"("corporate_account_id")));



CREATE POLICY "corporate members read account" ON "public"."corporate_accounts" FOR SELECT USING ((("is_active" = true) AND "public"."is_corporate_member"("id")));



CREATE POLICY "corporate members read own ads" ON "public"."advertisements" FOR SELECT USING ((("corporate_account_id" IS NOT NULL) AND "public"."is_corporate_member"("corporate_account_id")));



CREATE POLICY "corporate members read own members" ON "public"."corporate_members" FOR SELECT USING ("public"."is_corporate_member"("account_id"));



CREATE POLICY "corporate owners manage members" ON "public"."corporate_members" USING ("public"."is_corporate_owner"("account_id")) WITH CHECK ("public"."is_corporate_owner"("account_id"));



CREATE POLICY "corporate owners update account" ON "public"."corporate_accounts" FOR UPDATE USING ("public"."is_corporate_owner"("id"));



CREATE POLICY "corporate read own analytics" ON "public"."advert_analytics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."advertisements" "a"
  WHERE (("a"."id" = "advert_analytics"."ad_id") AND "public"."is_corporate_member"("a"."corporate_account_id")))));



CREATE POLICY "corporate read own invoices" ON "public"."payments" FOR SELECT USING ((("related_ad_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."advertisements" "a"
  WHERE (("a"."id" = "payments"."related_ad_id") AND "public"."is_corporate_member"("a"."corporate_account_id"))))));



ALTER TABLE "public"."corporate_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."corporate_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_otps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own delete profile_votes" ON "public"."profile_votes" FOR DELETE USING (("auth"."uid"() = "voter_id"));



CREATE POLICY "own update profile_reviews" ON "public"."profile_reviews" FOR UPDATE USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "own update profile_votes" ON "public"."profile_votes" FOR UPDATE USING (("auth"."uid"() = "voter_id"));



CREATE POLICY "participants insert conversation" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "participants insert messages" ON "public"."direct_messages" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "direct_messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "participants read conversation" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "participants read messages" ON "public"."direct_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "direct_messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portfolio_sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_views_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public insert advert_leads" ON "public"."advert_leads" FOR INSERT WITH CHECK (true);



CREATE POLICY "public read ad_carousel_settings" ON "public"."ad_carousel_settings" FOR SELECT USING (true);



CREATE POLICY "public read bids" ON "public"."bids" FOR SELECT USING (true);



CREATE POLICY "public read billing_notifications" ON "public"."billing_notifications" FOR SELECT USING (true);



CREATE POLICY "public read impressions" ON "public"."ad_impressions" FOR SELECT USING (true);



CREATE POLICY "public read jobs" ON "public"."jobs" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public read platform_settings" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "public read portfolio_sites" ON "public"."portfolio_sites" FOR SELECT USING (true);



CREATE POLICY "public read profile_reviews" ON "public"."profile_reviews" FOR SELECT USING (true);



CREATE POLICY "public read profile_votes" ON "public"."profile_votes" FOR SELECT USING (true);



CREATE POLICY "public read profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "public read ratings" ON "public"."ratings" FOR SELECT USING (true);



CREATE POLICY "public read service_ads" ON "public"."service_ads" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public read service_ratings" ON "public"."service_ratings" FOR SELECT USING (true);



CREATE POLICY "public read testimonials" ON "public"."testimonials" FOR SELECT USING (true);



CREATE POLICY "public_insert_messages" ON "public"."messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "public_read_payments" ON "public"."payments" FOR SELECT USING (true);



ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "self read notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "self read participants" ON "public"."conversation_participants" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "self update notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."service_ads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_visits_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admin manage advert_leads" ON "public"."advert_leads" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin manages corporate_accounts" ON "public"."corporate_accounts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin manages corporate_members" ON "public"."corporate_members" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin read email_providers" ON "public"."email_providers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin write email_providers" ON "public"."email_providers" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_read_own_role" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "users_read_own_views" ON "public"."profile_views_log" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."direct_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."admin_newsletter"("action" "text", "p_email" "text", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_newsletter"("action" "text", "p_email" "text", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_newsletter"("action" "text", "p_email" "text", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_reset_password"("p_user_id" "uuid", "p_new_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_reset_password"("p_user_id" "uuid", "p_new_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_reset_password"("p_user_id" "uuid", "p_new_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"("p_id" "uuid", "p_full_name" "text", "p_email" "text", "p_phone" "text", "p_role" "text", "p_location" "text", "p_skills" "text", "p_resume" "text", "p_county" "text", "p_subcounty" "text", "p_profile_image" "text", "p_ratings_enabled" boolean, "p_terms_accepted" boolean, "p_data_sharing_consent" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"("p_id" "uuid", "p_full_name" "text", "p_email" "text", "p_phone" "text", "p_role" "text", "p_location" "text", "p_skills" "text", "p_resume" "text", "p_county" "text", "p_subcounty" "text", "p_profile_image" "text", "p_ratings_enabled" boolean, "p_terms_accepted" boolean, "p_data_sharing_consent" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"("p_id" "uuid", "p_full_name" "text", "p_email" "text", "p_phone" "text", "p_role" "text", "p_location" "text", "p_skills" "text", "p_resume" "text", "p_county" "text", "p_subcounty" "text", "p_profile_image" "text", "p_ratings_enabled" boolean, "p_terms_accepted" boolean, "p_data_sharing_consent" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_newsletter_subscriber_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_newsletter_subscriber_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_newsletter_subscriber_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_ranking"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_ranking"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_ranking"("p_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_view_history"("p_profile_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_view_history"("p_profile_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_view_history"("p_profile_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_site_traffic"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_site_traffic"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_site_traffic"("p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_bid_accepted_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_bid_accepted_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_bid_accepted_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_bid_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_bid_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_bid_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_direct_message_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_direct_message_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_direct_message_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ad_click"("ad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ad_click"("ad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ad_click"("ad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ad_display"("ad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ad_display"("ad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ad_display"("ad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_profile_views"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_profile_views"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_profile_views"("p_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_corporate_member"("p_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_corporate_member"("p_account_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_corporate_owner"("p_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_corporate_owner"("p_account_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."newsletter_subscribe"("p_email" "text", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."newsletter_subscribe"("p_email" "text", "p_name" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_profile_rating"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_profile_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_rating"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_service_rating"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_service_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_service_rating"() TO "authenticated";


















GRANT SELECT ON TABLE "public"."ad_carousel_settings" TO "anon";
GRANT ALL ON TABLE "public"."ad_carousel_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_carousel_settings" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."ad_impressions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ad_impressions" TO "authenticated";



GRANT SELECT ON TABLE "public"."advert_analytics" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."advert_analytics" TO "authenticated";



GRANT SELECT ON TABLE "public"."advert_leads" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."advert_leads" TO "authenticated";



GRANT SELECT ON TABLE "public"."advertisements" TO "anon";
GRANT ALL ON TABLE "public"."advertisements" TO "authenticated";
GRANT ALL ON TABLE "public"."advertisements" TO "service_role";



GRANT ALL ON TABLE "public"."bids" TO "anon";
GRANT ALL ON TABLE "public"."bids" TO "authenticated";
GRANT ALL ON TABLE "public"."bids" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."bids_with_bidder" TO "anon";
GRANT ALL ON TABLE "public"."bids_with_bidder" TO "authenticated";
GRANT ALL ON TABLE "public"."bids_with_bidder" TO "service_role";



GRANT SELECT ON TABLE "public"."billing_notifications" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."billing_notifications" TO "authenticated";



GRANT SELECT ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT SELECT ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT SELECT ON TABLE "public"."corporate_accounts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."corporate_accounts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."corporate_accounts" TO "service_role";



GRANT SELECT ON TABLE "public"."corporate_members" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."corporate_members" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."corporate_members" TO "service_role";



GRANT SELECT ON TABLE "public"."corporate_signups" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."corporate_signups" TO "authenticated";



GRANT SELECT ON TABLE "public"."custom_categories" TO "anon";
GRANT ALL ON TABLE "public"."custom_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_categories" TO "service_role";



GRANT SELECT ON TABLE "public"."direct_messages" TO "anon";
GRANT ALL ON TABLE "public"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";



GRANT SELECT ON TABLE "public"."email_providers" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."email_providers" TO "authenticated";
GRANT SELECT ON TABLE "public"."email_providers" TO "service_role";



GRANT SELECT("password") ON TABLE "public"."email_providers" TO "service_role";



GRANT SELECT ON TABLE "public"."job_otps" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_otps" TO "authenticated";



GRANT SELECT,INSERT ON TABLE "public"."job_views_log" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_views_log" TO "authenticated";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."jobs_with_poster" TO "anon";
GRANT ALL ON TABLE "public"."jobs_with_poster" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs_with_poster" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT SELECT ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT SELECT ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."service_ads" TO "anon";
GRANT ALL ON TABLE "public"."service_ads" TO "authenticated";
GRANT ALL ON TABLE "public"."service_ads" TO "service_role";



GRANT ALL ON TABLE "public"."platform_stats" TO "anon";
GRANT ALL ON TABLE "public"."platform_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_stats" TO "service_role";



GRANT SELECT ON TABLE "public"."portfolio_sites" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."portfolio_sites" TO "authenticated";



GRANT SELECT ON TABLE "public"."profile_reviews" TO "anon";
GRANT ALL ON TABLE "public"."profile_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_reviews" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."profile_views_log" TO "anon";
GRANT ALL ON TABLE "public"."profile_views_log" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_views_log" TO "service_role";



GRANT SELECT ON TABLE "public"."profile_votes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profile_votes" TO "authenticated";



GRANT SELECT ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT SELECT ON TABLE "public"."service_ratings" TO "anon";
GRANT ALL ON TABLE "public"."service_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."service_ratings" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."site_visits_log" TO "anon";
GRANT ALL ON TABLE "public"."site_visits_log" TO "authenticated";
GRANT ALL ON TABLE "public"."site_visits_log" TO "service_role";



GRANT SELECT ON TABLE "public"."testimonials" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."testimonials" TO "authenticated";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT USAGE ON SEQUENCES TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";




























drop extension if exists "pg_net";

drop policy "All users can read categories" on "public"."custom_categories";

drop policy "Anyone can insert job views" on "public"."job_views_log";

drop policy "public read jobs" on "public"."jobs";

drop policy "anyone_insert_views" on "public"."profile_views_log";

drop policy "public read service_ads" on "public"."service_ads";

drop policy "anyone_insert_visits" on "public"."site_visits_log";

revoke delete on table "public"."ad_carousel_settings" from "anon";

revoke insert on table "public"."ad_carousel_settings" from "anon";

revoke references on table "public"."ad_carousel_settings" from "anon";

revoke trigger on table "public"."ad_carousel_settings" from "anon";

revoke truncate on table "public"."ad_carousel_settings" from "anon";

revoke update on table "public"."ad_carousel_settings" from "anon";

revoke delete on table "public"."ad_impressions" from "anon";

revoke references on table "public"."ad_impressions" from "anon";

revoke trigger on table "public"."ad_impressions" from "anon";

revoke truncate on table "public"."ad_impressions" from "anon";

revoke update on table "public"."ad_impressions" from "anon";

revoke references on table "public"."ad_impressions" from "authenticated";

revoke trigger on table "public"."ad_impressions" from "authenticated";

revoke truncate on table "public"."ad_impressions" from "authenticated";

revoke delete on table "public"."ad_impressions" from "service_role";

revoke insert on table "public"."ad_impressions" from "service_role";

revoke references on table "public"."ad_impressions" from "service_role";

revoke select on table "public"."ad_impressions" from "service_role";

revoke trigger on table "public"."ad_impressions" from "service_role";

revoke truncate on table "public"."ad_impressions" from "service_role";

revoke update on table "public"."ad_impressions" from "service_role";

revoke delete on table "public"."advert_analytics" from "anon";

revoke insert on table "public"."advert_analytics" from "anon";

revoke references on table "public"."advert_analytics" from "anon";

revoke trigger on table "public"."advert_analytics" from "anon";

revoke truncate on table "public"."advert_analytics" from "anon";

revoke update on table "public"."advert_analytics" from "anon";

revoke references on table "public"."advert_analytics" from "authenticated";

revoke trigger on table "public"."advert_analytics" from "authenticated";

revoke truncate on table "public"."advert_analytics" from "authenticated";

revoke delete on table "public"."advert_analytics" from "service_role";

revoke insert on table "public"."advert_analytics" from "service_role";

revoke references on table "public"."advert_analytics" from "service_role";

revoke select on table "public"."advert_analytics" from "service_role";

revoke trigger on table "public"."advert_analytics" from "service_role";

revoke truncate on table "public"."advert_analytics" from "service_role";

revoke update on table "public"."advert_analytics" from "service_role";

revoke delete on table "public"."advert_leads" from "anon";

revoke insert on table "public"."advert_leads" from "anon";

revoke references on table "public"."advert_leads" from "anon";

revoke trigger on table "public"."advert_leads" from "anon";

revoke truncate on table "public"."advert_leads" from "anon";

revoke update on table "public"."advert_leads" from "anon";

revoke references on table "public"."advert_leads" from "authenticated";

revoke trigger on table "public"."advert_leads" from "authenticated";

revoke truncate on table "public"."advert_leads" from "authenticated";

revoke delete on table "public"."advert_leads" from "service_role";

revoke insert on table "public"."advert_leads" from "service_role";

revoke references on table "public"."advert_leads" from "service_role";

revoke select on table "public"."advert_leads" from "service_role";

revoke trigger on table "public"."advert_leads" from "service_role";

revoke truncate on table "public"."advert_leads" from "service_role";

revoke update on table "public"."advert_leads" from "service_role";

revoke delete on table "public"."advertisements" from "anon";

revoke insert on table "public"."advertisements" from "anon";

revoke references on table "public"."advertisements" from "anon";

revoke trigger on table "public"."advertisements" from "anon";

revoke truncate on table "public"."advertisements" from "anon";

revoke update on table "public"."advertisements" from "anon";

revoke delete on table "public"."billing_notifications" from "anon";

revoke insert on table "public"."billing_notifications" from "anon";

revoke references on table "public"."billing_notifications" from "anon";

revoke trigger on table "public"."billing_notifications" from "anon";

revoke truncate on table "public"."billing_notifications" from "anon";

revoke update on table "public"."billing_notifications" from "anon";

revoke references on table "public"."billing_notifications" from "authenticated";

revoke trigger on table "public"."billing_notifications" from "authenticated";

revoke truncate on table "public"."billing_notifications" from "authenticated";

revoke delete on table "public"."billing_notifications" from "service_role";

revoke insert on table "public"."billing_notifications" from "service_role";

revoke references on table "public"."billing_notifications" from "service_role";

revoke select on table "public"."billing_notifications" from "service_role";

revoke trigger on table "public"."billing_notifications" from "service_role";

revoke truncate on table "public"."billing_notifications" from "service_role";

revoke update on table "public"."billing_notifications" from "service_role";

revoke delete on table "public"."conversation_participants" from "anon";

revoke insert on table "public"."conversation_participants" from "anon";

revoke references on table "public"."conversation_participants" from "anon";

revoke trigger on table "public"."conversation_participants" from "anon";

revoke truncate on table "public"."conversation_participants" from "anon";

revoke update on table "public"."conversation_participants" from "anon";

revoke delete on table "public"."conversations" from "anon";

revoke insert on table "public"."conversations" from "anon";

revoke references on table "public"."conversations" from "anon";

revoke trigger on table "public"."conversations" from "anon";

revoke truncate on table "public"."conversations" from "anon";

revoke update on table "public"."conversations" from "anon";

revoke delete on table "public"."corporate_accounts" from "anon";

revoke insert on table "public"."corporate_accounts" from "anon";

revoke references on table "public"."corporate_accounts" from "anon";

revoke trigger on table "public"."corporate_accounts" from "anon";

revoke truncate on table "public"."corporate_accounts" from "anon";

revoke update on table "public"."corporate_accounts" from "anon";

revoke references on table "public"."corporate_accounts" from "authenticated";

revoke trigger on table "public"."corporate_accounts" from "authenticated";

revoke truncate on table "public"."corporate_accounts" from "authenticated";

revoke references on table "public"."corporate_accounts" from "service_role";

revoke trigger on table "public"."corporate_accounts" from "service_role";

revoke truncate on table "public"."corporate_accounts" from "service_role";

revoke delete on table "public"."corporate_members" from "anon";

revoke insert on table "public"."corporate_members" from "anon";

revoke references on table "public"."corporate_members" from "anon";

revoke trigger on table "public"."corporate_members" from "anon";

revoke truncate on table "public"."corporate_members" from "anon";

revoke update on table "public"."corporate_members" from "anon";

revoke references on table "public"."corporate_members" from "authenticated";

revoke trigger on table "public"."corporate_members" from "authenticated";

revoke truncate on table "public"."corporate_members" from "authenticated";

revoke references on table "public"."corporate_members" from "service_role";

revoke trigger on table "public"."corporate_members" from "service_role";

revoke truncate on table "public"."corporate_members" from "service_role";

revoke delete on table "public"."corporate_signups" from "anon";

revoke insert on table "public"."corporate_signups" from "anon";

revoke references on table "public"."corporate_signups" from "anon";

revoke trigger on table "public"."corporate_signups" from "anon";

revoke truncate on table "public"."corporate_signups" from "anon";

revoke update on table "public"."corporate_signups" from "anon";

revoke references on table "public"."corporate_signups" from "authenticated";

revoke trigger on table "public"."corporate_signups" from "authenticated";

revoke truncate on table "public"."corporate_signups" from "authenticated";

revoke delete on table "public"."corporate_signups" from "service_role";

revoke insert on table "public"."corporate_signups" from "service_role";

revoke references on table "public"."corporate_signups" from "service_role";

revoke select on table "public"."corporate_signups" from "service_role";

revoke trigger on table "public"."corporate_signups" from "service_role";

revoke truncate on table "public"."corporate_signups" from "service_role";

revoke update on table "public"."corporate_signups" from "service_role";

revoke delete on table "public"."custom_categories" from "anon";

revoke insert on table "public"."custom_categories" from "anon";

revoke references on table "public"."custom_categories" from "anon";

revoke trigger on table "public"."custom_categories" from "anon";

revoke truncate on table "public"."custom_categories" from "anon";

revoke update on table "public"."custom_categories" from "anon";

revoke delete on table "public"."direct_messages" from "anon";

revoke insert on table "public"."direct_messages" from "anon";

revoke references on table "public"."direct_messages" from "anon";

revoke trigger on table "public"."direct_messages" from "anon";

revoke truncate on table "public"."direct_messages" from "anon";

revoke update on table "public"."direct_messages" from "anon";

revoke delete on table "public"."email_providers" from "anon";

revoke insert on table "public"."email_providers" from "anon";

revoke references on table "public"."email_providers" from "anon";

revoke trigger on table "public"."email_providers" from "anon";

revoke truncate on table "public"."email_providers" from "anon";

revoke update on table "public"."email_providers" from "anon";

revoke references on table "public"."email_providers" from "authenticated";

revoke trigger on table "public"."email_providers" from "authenticated";

revoke truncate on table "public"."email_providers" from "authenticated";

revoke delete on table "public"."email_providers" from "service_role";

revoke insert on table "public"."email_providers" from "service_role";

revoke references on table "public"."email_providers" from "service_role";

revoke trigger on table "public"."email_providers" from "service_role";

revoke truncate on table "public"."email_providers" from "service_role";

revoke update on table "public"."email_providers" from "service_role";

revoke delete on table "public"."job_otps" from "anon";

revoke insert on table "public"."job_otps" from "anon";

revoke references on table "public"."job_otps" from "anon";

revoke trigger on table "public"."job_otps" from "anon";

revoke truncate on table "public"."job_otps" from "anon";

revoke update on table "public"."job_otps" from "anon";

revoke references on table "public"."job_otps" from "authenticated";

revoke trigger on table "public"."job_otps" from "authenticated";

revoke truncate on table "public"."job_otps" from "authenticated";

revoke delete on table "public"."job_otps" from "service_role";

revoke insert on table "public"."job_otps" from "service_role";

revoke references on table "public"."job_otps" from "service_role";

revoke select on table "public"."job_otps" from "service_role";

revoke trigger on table "public"."job_otps" from "service_role";

revoke truncate on table "public"."job_otps" from "service_role";

revoke update on table "public"."job_otps" from "service_role";

revoke delete on table "public"."job_views_log" from "anon";

revoke references on table "public"."job_views_log" from "anon";

revoke trigger on table "public"."job_views_log" from "anon";

revoke truncate on table "public"."job_views_log" from "anon";

revoke update on table "public"."job_views_log" from "anon";

revoke references on table "public"."job_views_log" from "authenticated";

revoke trigger on table "public"."job_views_log" from "authenticated";

revoke truncate on table "public"."job_views_log" from "authenticated";

revoke delete on table "public"."job_views_log" from "service_role";

revoke insert on table "public"."job_views_log" from "service_role";

revoke references on table "public"."job_views_log" from "service_role";

revoke select on table "public"."job_views_log" from "service_role";

revoke trigger on table "public"."job_views_log" from "service_role";

revoke truncate on table "public"."job_views_log" from "service_role";

revoke update on table "public"."job_views_log" from "service_role";

revoke delete on table "public"."newsletter_subscribers" from "anon";

revoke references on table "public"."newsletter_subscribers" from "anon";

revoke trigger on table "public"."newsletter_subscribers" from "anon";

revoke truncate on table "public"."newsletter_subscribers" from "anon";

revoke update on table "public"."newsletter_subscribers" from "anon";

revoke delete on table "public"."notifications" from "anon";

revoke insert on table "public"."notifications" from "anon";

revoke references on table "public"."notifications" from "anon";

revoke trigger on table "public"."notifications" from "anon";

revoke truncate on table "public"."notifications" from "anon";

revoke update on table "public"."notifications" from "anon";

revoke delete on table "public"."platform_settings" from "anon";

revoke insert on table "public"."platform_settings" from "anon";

revoke references on table "public"."platform_settings" from "anon";

revoke trigger on table "public"."platform_settings" from "anon";

revoke truncate on table "public"."platform_settings" from "anon";

revoke update on table "public"."platform_settings" from "anon";

revoke delete on table "public"."portfolio_sites" from "anon";

revoke insert on table "public"."portfolio_sites" from "anon";

revoke references on table "public"."portfolio_sites" from "anon";

revoke trigger on table "public"."portfolio_sites" from "anon";

revoke truncate on table "public"."portfolio_sites" from "anon";

revoke update on table "public"."portfolio_sites" from "anon";

revoke references on table "public"."portfolio_sites" from "authenticated";

revoke trigger on table "public"."portfolio_sites" from "authenticated";

revoke truncate on table "public"."portfolio_sites" from "authenticated";

revoke delete on table "public"."portfolio_sites" from "service_role";

revoke insert on table "public"."portfolio_sites" from "service_role";

revoke references on table "public"."portfolio_sites" from "service_role";

revoke select on table "public"."portfolio_sites" from "service_role";

revoke trigger on table "public"."portfolio_sites" from "service_role";

revoke truncate on table "public"."portfolio_sites" from "service_role";

revoke update on table "public"."portfolio_sites" from "service_role";

revoke delete on table "public"."profile_reviews" from "anon";

revoke insert on table "public"."profile_reviews" from "anon";

revoke references on table "public"."profile_reviews" from "anon";

revoke trigger on table "public"."profile_reviews" from "anon";

revoke truncate on table "public"."profile_reviews" from "anon";

revoke update on table "public"."profile_reviews" from "anon";

revoke delete on table "public"."profile_views_log" from "anon";

revoke references on table "public"."profile_views_log" from "anon";

revoke trigger on table "public"."profile_views_log" from "anon";

revoke truncate on table "public"."profile_views_log" from "anon";

revoke update on table "public"."profile_views_log" from "anon";

revoke delete on table "public"."profile_votes" from "anon";

revoke insert on table "public"."profile_votes" from "anon";

revoke references on table "public"."profile_votes" from "anon";

revoke trigger on table "public"."profile_votes" from "anon";

revoke truncate on table "public"."profile_votes" from "anon";

revoke update on table "public"."profile_votes" from "anon";

revoke references on table "public"."profile_votes" from "authenticated";

revoke trigger on table "public"."profile_votes" from "authenticated";

revoke truncate on table "public"."profile_votes" from "authenticated";

revoke delete on table "public"."profile_votes" from "service_role";

revoke insert on table "public"."profile_votes" from "service_role";

revoke references on table "public"."profile_votes" from "service_role";

revoke select on table "public"."profile_votes" from "service_role";

revoke trigger on table "public"."profile_votes" from "service_role";

revoke truncate on table "public"."profile_votes" from "service_role";

revoke update on table "public"."profile_votes" from "service_role";

revoke delete on table "public"."ratings" from "anon";

revoke insert on table "public"."ratings" from "anon";

revoke references on table "public"."ratings" from "anon";

revoke trigger on table "public"."ratings" from "anon";

revoke truncate on table "public"."ratings" from "anon";

revoke update on table "public"."ratings" from "anon";

revoke delete on table "public"."service_ratings" from "anon";

revoke insert on table "public"."service_ratings" from "anon";

revoke references on table "public"."service_ratings" from "anon";

revoke trigger on table "public"."service_ratings" from "anon";

revoke truncate on table "public"."service_ratings" from "anon";

revoke update on table "public"."service_ratings" from "anon";

revoke delete on table "public"."site_visits_log" from "anon";

revoke references on table "public"."site_visits_log" from "anon";

revoke trigger on table "public"."site_visits_log" from "anon";

revoke truncate on table "public"."site_visits_log" from "anon";

revoke update on table "public"."site_visits_log" from "anon";

revoke delete on table "public"."testimonials" from "anon";

revoke insert on table "public"."testimonials" from "anon";

revoke references on table "public"."testimonials" from "anon";

revoke trigger on table "public"."testimonials" from "anon";

revoke truncate on table "public"."testimonials" from "anon";

revoke update on table "public"."testimonials" from "anon";

revoke references on table "public"."testimonials" from "authenticated";

revoke trigger on table "public"."testimonials" from "authenticated";

revoke truncate on table "public"."testimonials" from "authenticated";

revoke delete on table "public"."testimonials" from "service_role";

revoke insert on table "public"."testimonials" from "service_role";

revoke references on table "public"."testimonials" from "service_role";

revoke select on table "public"."testimonials" from "service_role";

revoke trigger on table "public"."testimonials" from "service_role";

revoke truncate on table "public"."testimonials" from "service_role";

revoke update on table "public"."testimonials" from "service_role";


  create policy "All users can read categories"
  on "public"."custom_categories"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can insert job views"
  on "public"."job_views_log"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "public read jobs"
  on "public"."jobs"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "anyone_insert_views"
  on "public"."profile_views_log"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "public read service_ads"
  on "public"."service_ads"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "anyone_insert_visits"
  on "public"."site_visits_log"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow authenticated inserts"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'adverts'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Allow public read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'adverts'::text));



  create policy "Allow users to delete own objects"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'adverts'::text) AND (auth.uid() = owner)));



  create policy "Allow users to update own objects"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'adverts'::text) AND (auth.uid() = owner)));



  create policy "Auth Delete"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = ANY (ARRAY['jobs'::text, 'adverts'::text])));



  create policy "Auth Insert"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = ANY (ARRAY['jobs'::text, 'adverts'::text])));



  create policy "Auth Update"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = ANY (ARRAY['jobs'::text, 'adverts'::text])));



  create policy "Auth Upload Adverts"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'adverts'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Auth Upload Jobs"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'jobs'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated users can delete adverts"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'adverts'::text) AND (auth.uid() IS NOT NULL)));



  create policy "Authenticated users can update adverts"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'adverts'::text) AND (auth.uid() IS NOT NULL)));



  create policy "Authenticated users can upload to adverts"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'adverts'::text) AND (auth.uid() IS NOT NULL)));



  create policy "Public Access"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = ANY (ARRAY['jobs'::text, 'adverts'::text])));



