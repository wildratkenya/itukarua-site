-- Data retention automation.
--
-- The Privacy Policy commits to specific retention windows. This function is
-- what makes those windows true instead of aspirational: it is the single place
-- that deletes rows by age, and pg_cron runs it once a day.
--
-- Deliberately NOT touched here:
--   * payments / invoices - kept five years for the Tax Procedures Act, 2015
--     (only the phone number is pseudonymised after five years).
--   * direct_messages       - user-to-user content, kept while the account is
--     active and removed by account deletion.
--   * profiles              - removed by account deletion, not by age.

create extension if not exists pg_cron;

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_support     int;
  v_impressions int;
  v_views       int;
  v_job_views   int;
  v_site_visits int;
  v_otps        int;
  v_notes       int;
  v_limits      int;
  v_phones      int;
begin
  -- Support conversations and chatbot transcripts: 24 months.
  delete from public.messages
   where type in ('support', 'chat_transcript')
     and created_at < now() - interval '24 months';
  get diagnostics v_support = row_count;

  -- Ad measurement: 90 days.
  delete from public.ad_impressions
   where served_at < now() - interval '90 days';
  get diagnostics v_impressions = row_count;

  -- View analytics: 12 months.
  delete from public.profile_views_log
   where viewed_at < now() - interval '12 months';
  get diagnostics v_views = row_count;

  delete from public.job_views_log
   where created_at < now() - interval '12 months';
  get diagnostics v_job_views = row_count;

  delete from public.site_visits_log
   where created_at < now() - interval '12 months';
  get diagnostics v_site_visits = row_count;

  -- One-time job codes: useless after a day.
  delete from public.job_otps
   where created_at < now() - interval '1 day';
  get diagnostics v_otps = row_count;

  -- Read notifications: 90 days. Unread ones stay so the user still sees them.
  delete from public.notifications
   where is_read and created_at < now() - interval '90 days';
  get diagnostics v_notes = row_count;

  -- Rate-limit windows are only meaningful for a day.
  delete from public.rate_limit_counters
   where window_start < now() - interval '1 day';
  get diagnostics v_limits = row_count;

  -- Payment records stay five years; after that the phone number is dropped so
  -- what remains is a pseudonymised accounting record.
  update public.payments
     set mpesa_phone = null
   where created_at < now() - interval '5 years'
     and mpesa_phone is not null;
  get diagnostics v_phones = row_count;

  return jsonb_build_object(
    'support_messages', v_support,
    'ad_impressions', v_impressions,
    'profile_views', v_views,
    'job_views', v_job_views,
    'site_visits', v_site_visits,
    'job_otps', v_otps,
    'notifications', v_notes,
    'rate_limit_counters', v_limits,
    'payment_phones_anonymised', v_phones
  );
end;
$$;

revoke all on function public.purge_expired_data() from public;
revoke all on function public.purge_expired_data() from anon, authenticated;

select cron.schedule(
  'itukarua-retention',
  '15 2 * * *',
  $$select public.purge_expired_data()$$
);
