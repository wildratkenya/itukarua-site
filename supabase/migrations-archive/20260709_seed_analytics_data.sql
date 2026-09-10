-- Seed sample analytics data for admin@itukarua.co.ke
-- Run this in Supabase Dashboard SQL Editor

DO $$
DECLARE
  v_user_id uuid;
  v_dates date[];
  v_date date;
  v_views int;
  v_visits int;
  v_pages text[] := ARRAY['home', 'jobs', 'services', 'pricing', 'dashboard', 'about', 'contact', 'jobs', 'dashboard', 'services'];
BEGIN
  -- Lookup the user
  SELECT id INTO v_user_id FROM profiles WHERE email = 'admin@itukarua.co.ke' LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User admin@itukarua.co.ke not found in profiles table';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding data for user ID: %', v_user_id;

  -- Already has some views? Only seed if empty
  IF (SELECT COUNT(*) FROM profile_views_log WHERE profile_id = v_user_id) = 0 THEN
    -- Profile views spread over last 28 days
    FOR i IN 0..27 LOOP
      v_date := current_date - i;
      v_views := (random() * 5 + 1)::int;
      
      FOR j IN 1..v_views LOOP
        INSERT INTO profile_views_log (profile_id, viewer_id, created_at)
        VALUES (v_user_id, NULL, v_date + (random() * 23 || ' hours')::interval);
      END LOOP;
    END LOOP;
    RAISE NOTICE 'Inserted profile views for last 28 days';
  ELSE
    RAISE NOTICE 'profile_views_log already has data, skipping';
  END IF;

  -- Site visits spread over last 28 days
  IF (SELECT COUNT(*) FROM site_visits_log) = 0 THEN
    FOR i IN 0..27 LOOP
      v_date := current_date - i;
      v_visits := (random() * 8 + 3)::int;
      
      FOR j IN 1..v_visits LOOP
        INSERT INTO site_visits_log (user_id, page_path, created_at)
        VALUES (
          CASE WHEN random() < 0.4 THEN v_user_id ELSE NULL END,
          v_pages[1 + (random() * array_length(v_pages, 1))::int % array_length(v_pages, 1)],
          v_date + (random() * 23 || ' hours')::interval
        );
      END LOOP;
    END LOOP;
    RAISE NOTICE 'Inserted site visits for last 28 days';
  ELSE
    RAISE NOTICE 'site_visits_log already has data, skipping';
  END IF;

  -- Also set some profile_views on the profiles table so the stat card shows a number
  UPDATE profiles SET profile_views = (
    SELECT COUNT(*) FROM profile_views_log WHERE profile_id = v_user_id
  ) WHERE id = v_user_id;

  RAISE NOTICE 'Updated profile.profile_views count';

  -- The ranking RPC only considers jobseekers, so skip the self-review for admin/employer roles
  IF EXISTS (SELECT FROM profiles WHERE id = v_user_id AND role = 'jobseeker') THEN
    IF NOT EXISTS (SELECT FROM profile_reviews WHERE profile_id = v_user_id LIMIT 1) THEN
      INSERT INTO profile_reviews (reviewer_id, profile_id, rating, comment, created_at)
      VALUES (v_user_id, v_user_id, 5, 'Great professional!', now() - interval '10 days')
      ON CONFLICT DO NOTHING;

      UPDATE profiles SET
        reviews_count = (SELECT COUNT(*) FROM profile_reviews WHERE profile_id = v_user_id),
        rating = (SELECT COALESCE(AVG(rating), 0) FROM profile_reviews WHERE profile_id = v_user_id)
      WHERE id = v_user_id;
      
      RAISE NOTICE 'Added sample review and updated profile rating';
    END IF;
  END IF;

  RAISE NOTICE 'Seeding complete! Rows in profile_views_log: %, site_visits_log: %',
    (SELECT COUNT(*) FROM profile_views_log), (SELECT COUNT(*) FROM site_visits_log);
END $$;
