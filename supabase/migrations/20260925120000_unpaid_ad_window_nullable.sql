-- An advert that has never been paid for has no live window yet.
--
-- 20260917140000_ad_expiry_required.sql and 20260917150000_all_products_expiry_required.sql
-- made every advert carry a billing window, which is right for anything serving but
-- blocks the "create it hidden, take the money, then switch it on" flow: the insert
-- would fail before the customer ever reached the payment prompt.
--
-- So: relax the columns to nullable, and move the guarantee from the column level
-- to a paid-aware CHECK. The rule "a paid advert always has an expiry" is kept — it
-- just becomes conditional on payment_confirmed instead of unconditional.

-- ─── service_ads ──────────────────────────────────────────────────────────────
alter table public.service_ads
  alter column billing_start drop not null,
  alter column billing_end drop not null,
  alter column expiry_date drop not null;

-- The unconditional window checks assume a non-null window, so replace them.
alter table public.service_ads drop constraint if exists service_ads_billing_window;
alter table public.service_ads drop constraint if exists service_ads_expiry_window;

-- Any advert already marked paid must still have a complete, sensible window.
-- Unpaid rows are exempt, and that is the only exemption.
alter table public.service_ads
  add constraint service_ads_paid_window check (
    coalesce(payment_confirmed, false) = false
    or (
      billing_start is not null
      and billing_end is not null
      and expiry_date is not null
    )
  );

-- Inverted/overlapping windows are still rejected whenever both ends exist.
alter table public.service_ads
  add constraint service_ads_billing_window check (
    billing_start is null or billing_end is null or billing_end > billing_start
  );

alter table public.service_ads
  add constraint service_ads_expiry_window check (
    billing_start is null or expiry_date >= (billing_start)::date
  );

comment on constraint service_ads_paid_window on public.service_ads is
  'A paid advert must have a complete billing window and expiry date; an unpaid one may have none.';

-- Unpaid adverts are the ones /admin and the expiry cron need to sweep.
create index if not exists service_ads_unpaid_idx
  on public.service_ads (created_at desc)
  where coalesce(payment_confirmed, false) = false;

-- ─── advertisements (admin banners) ───────────────────────────────────────────
-- Banners are still created by an admin with their slot and cycle, so their window
-- stays NOT NULL. What they were missing is a way to tell "never paid for" apart
-- from "an admin paused it", which is why derive_banner_status had to guess from
-- a null window that can no longer be null.
alter table public.advertisements
  add column if not exists payment_confirmed boolean not null default false;

-- Backfill from what we can actually observe: a banner that is serving was paid
-- for, a banner that is switched off is not currently published. This only drives
-- the status label — delivery still requires active — so a conservative backfill
-- cannot accidentally put an unpaid banner on the site.
update public.advertisements
set payment_confirmed = coalesce(active, false)
where payment_confirmed = false and active = true;

create index if not exists advertisements_unpaid_idx
  on public.advertisements (created_at desc)
  where payment_confirmed = false;
