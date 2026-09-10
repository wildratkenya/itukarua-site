-- Public subscriber count for the homepage stat (works for anonymous visitors).
CREATE OR REPLACE FUNCTION public.get_newsletter_subscriber_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.newsletter_subscribers;
$$;

GRANT EXECUTE ON FUNCTION public.get_newsletter_subscriber_count() TO anon, authenticated, service_role;
