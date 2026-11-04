insert into public.platform_settings (key, value, updated_at)
values
  ('corporate_bronze_monthly', 3000, now()),
  ('corporate_silver_monthly', 6000, now()),
  ('corporate_gold_monthly', 10000, now()),
  ('corporate_sitewide_strip_monthly', 3000, now()),
  ('corporate_category_strip_monthly', 3000, now()),
  ('corporate_homepage_banner_monthly', 4000, now()),
  ('corporate_job_listings_top_monthly', 2000, now()),
  ('corporate_featured_monthly', 2000, now()),
  ('corporate_full_analytics_monthly', 1500, now()),
  ('corporate_multi_images_monthly', 1000, now()),
  ('corporate_placements_unit_monthly', 1000, now()),
  ('corporate_team_seats_unit_monthly', 500, now())
on conflict (key) do nothing;
