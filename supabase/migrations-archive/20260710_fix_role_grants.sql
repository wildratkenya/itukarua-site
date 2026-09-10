-- Restore the standard anon/authenticated role privileges that are missing
-- on this project (PostgREST returns 404/401 when the role has no grants,
-- regardless of RLS policies).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public-read tables (RLS policies decide which rows anon can see)
GRANT SELECT ON TABLE public.profiles, public.jobs, public.service_ads, public.bids,
  public.advertisements, public.custom_categories, public.ad_carousel_settings,
  public.ratings, public.service_ratings, public.profile_reviews, public.platform_stats
  TO anon;

-- Anonymous write paths used by the app (RLS policies gate the rows)
GRANT INSERT, SELECT ON TABLE public.messages, public.newsletter_subscribers,
  public.site_visits_log, public.profile_views_log TO anon;

-- Authenticated users get full CRUD (RLS policies gate the rows)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- RPCs (admin_newsletter, get_newsletter_subscriber_count, etc.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
