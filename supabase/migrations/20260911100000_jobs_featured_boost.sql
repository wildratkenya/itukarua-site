-- Make jobs boostable via the Featured Boost product.
-- Boosted jobs float to the top of search results and are pinned in the
-- listings; boost_until drives auto-expiry (client, boost-expire function).

alter table public.jobs
  add column featured boolean not null default false;

alter table public.jobs
  add column boost_until timestamp with time zone;