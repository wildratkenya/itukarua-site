-- Open the homepage carousel to ordinary banners.
--
-- 20260921100000_ad_corporate_slots_only.sql reserved all four placement slots,
-- which is why a plain banner could never serve: /admin refused to save one, the
-- Active toggle refused to switch it on, the self-heal force-paused it, the
-- delivery query filtered it out, and Add Days tripped the CHECK constraint when
-- it tried to activate it. All of those now key off CORPORATE_ONLY_SLOTS
-- (sitewide_strip, category_strip, job_listings_top).
--
-- The homepage carousel is a normal advertising placement that is also sold in
-- corporate bundles, so it must serve whichever banners are paid for and live.
-- A corporate account linked to it is still fine — the rule is about the slot,
-- not about the buyer.

-- The live error names the constraint in the singular
-- ("advertisements_corporate_slot_require_account") while the migration that
-- created it used the plural, so drop both and any other spelling of the same
-- rule rather than guessing which one actually exists.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.advertisements'::regclass
      and conname ~ 'corporate_slot.*require_account'
  loop
    execute format('alter table public.advertisements drop constraint %I', c.conname);
    raise notice 'dropped %', c.conname;
  end loop;
end $$;

alter table public.advertisements
  add constraint advertisements_corporate_slots_require_account
  check (
    active = false
    or slot not in ('sitewide_strip', 'category_strip', 'job_listings_top')
    or corporate_account_id is not null
    or corporate_tier is not null
  );

comment on constraint advertisements_corporate_slots_require_account on public.advertisements is
  'The reserved branded strips may only serve placements linked to a corporate account; homepage_banner is open to any paid banner.';

-- Re-publish banners the previous migration force-paused purely for being in
-- homepage_banner without a corporate account. They are ordinary paid adverts
-- that were switched off by the old rule, not something anyone chose to pause,
-- so restore the ones whose billing window is still valid. Anything genuinely
-- expired is left alone for the expiry path to handle.
--
-- payment_confirmed is set here too, and deliberately so: 20260925120000 backfilled
-- that flag from `active = true`, and these rows were already false by the time it
-- ran because 20260921100000 had paused them. Reactivating them without it would
-- leave a live, paid placement labelled "unpaid" and — since delivery now requires
-- payment_confirmed — silently unserved. A valid unexpired window is the evidence
-- that these were paid for.
update public.advertisements
set active = true,
    payment_confirmed = true
where active = false
  and slot = 'homepage_banner'
  and corporate_account_id is null
  and corporate_tier is null
  and billing_start is not null
  and billing_end is not null
  and billing_end > now();
