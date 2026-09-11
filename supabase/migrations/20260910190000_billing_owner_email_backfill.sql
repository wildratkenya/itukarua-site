-- Backfill advertiser emails for billing from existing profiles
-- Adverts created via an account (owner_id set) get their profile email so
-- the admin Billing tab can send renewal alerts & invoices.
-- Rows without an owner_id have no recoverable email; they require manual
-- entry via the Banners / Ads tab advertiser-email field.

update public.advertisements a
set owner_email = p.email
from public.profiles p
where a.owner_id = p.id
  and nullif(a.owner_email, '') is null;

update public.service_ads a
set owner_email = p.email
from public.profiles p
where a.owner_id = p.id
  and nullif(a.owner_email, '') is null;