-- Same defect as corporate_signups: these tables were created without any
-- service_role grant, so every edge function writing to them failed with
-- "permission denied for table ..." (job OTPs, boost renewal notices, billing
-- notifications, advert analytics). Grants here don't expose anything —
-- service_role is server-only and anon/authenticated access is unchanged.
grant all on table
  public.ad_impressions,
  public.advert_analytics,
  public.advert_leads,
  public.billing_notifications,
  public.boost_renewal_notices,
  public.job_otps,
  public.job_views_log,
  public.portfolio_sites,
  public.profile_votes,
  public.testimonials
to service_role;
