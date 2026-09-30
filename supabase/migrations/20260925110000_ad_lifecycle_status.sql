-- Ad lifecycle: one derived status, shared by the client dashboards and /admin.
--
-- Status used to be inferred differently in each surface, so the same advert could
-- read as "live" on /admin and "expired" in the owner's dashboard. These functions
-- put the rule in the database so the client and every edge function derive the
-- same answer.
--
--   service_ads    unpaid  ->  scheduled  ->  active  ->  expired
--   advertisements unpaid  ->  scheduled  ->  active  <->  paused
--                                          active  ->  expired

-- ── Self-serve service adverts (service_ads) ────────────────────────────────
-- Deliberately keyed on payment_confirmed, not on dates: an unpaid advert has no
-- billing window at all, so a date-only rule would report it as "active".
create or replace function public.derive_ad_status(
  p_payment_confirmed boolean,
  p_billing_start timestamptz,
  p_billing_end timestamptz
) returns text
language sql
stable
as $$
  select case
    when coalesce(p_payment_confirmed, false) = false then 'unpaid'
    when p_billing_start is not null and p_billing_start > now() then 'scheduled'
    when p_billing_end is not null and p_billing_end <= now() then 'expired'
    else 'active'
  end;
$$;

-- ── Admin banners (advertisements) ───────────────────────────────────────────
-- A banner that has never been paid for is "unpaid"; one that an admin switched
-- off by hand is "paused", which is a different thing and must not read as unpaid
-- or expired. The column is added in 20260925120000_unpaid_ad_window_nullable.sql;
-- this function only takes it as a parameter, so the ordering is not a problem.
create or replace function public.derive_banner_status(
  p_payment_confirmed boolean,
  p_active boolean,
  p_billing_start timestamptz,
  p_billing_end timestamptz
) returns text
language sql
stable
as $$
  select case
    when coalesce(p_payment_confirmed, false) = false then 'unpaid'
    when p_billing_end is not null and p_billing_end <= now() then 'expired'
    when coalesce(p_active, false) = false then 'paused'
    when p_billing_start is not null and p_billing_start > now() then 'scheduled'
    else 'active'
  end;
$$;

comment on function public.derive_ad_status(boolean, timestamptz, timestamptz) is
  'Lifecycle status of a self-serve advert: unpaid | scheduled | active | expired.';
comment on function public.derive_banner_status(boolean, boolean, timestamptz, timestamptz) is
  'Lifecycle status of a banner: unpaid | scheduled | active | paused | expired.';

grant execute on function public.derive_ad_status(boolean, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.derive_banner_status(boolean, boolean, timestamptz, timestamptz) to anon, authenticated, service_role;

-- ── Expiry notice tracking ──────────────────────────────────────────────────
-- "On expiry, email the client" needs to know whether we already did, otherwise a
-- daily cron mails the owner of the same dead advert every day forever.
alter table public.service_ads
  add column if not exists expired_notified_at timestamptz;

alter table public.advertisements
  add column if not exists expired_notified_at timestamptz;

create index if not exists service_ads_expiry_unnotified_idx
  on public.service_ads (billing_end)
  where expired_notified_at is null;

create index if not exists advertisements_expiry_unnotified_idx
  on public.advertisements (billing_end)
  where expired_notified_at is null;
