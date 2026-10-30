begin;

-- Public listing surface for services. Internal columns (owner email, payment
-- state, billing window, invoice markers) never leave the database through this
-- view; every anonymous listing read goes here instead of the base table.
create or replace view public.service_directory as
select
  id,
  title,
  description,
  price,
  created_at,
  business_name,
  category,
  image,
  location,
  contact,
  plan,
  expiry_date,
  featured,
  rating,
  reviews_count,
  updated_at,
  images,
  contact_person,
  county,
  subcounty,
  boost_until,
  views_count,
  clicks_count,
  social_links,
  corporate_account_id,
  corporate_tier,
  destination_url
from public.service_ads
where payment_confirmed = true;

revoke all on public.service_directory from public;
grant select on public.service_directory to anon, authenticated;

-- The base table is now readable only by the owner, staff, or the corporate
-- account the advert is billed to.
drop policy if exists "public read service_ads" on public.service_ads;
drop policy if exists "service_ads read by owner staff or corporate" on public.service_ads;
create policy "service_ads read by owner staff or corporate" on public.service_ads
for select to authenticated
using (
  owner_id = auth.uid()
  or public.current_actor_is_privileged()
  or (corporate_account_id is not null and public.is_corporate_member(corporate_account_id))
);

revoke all on table public.service_ads from anon;

commit;
