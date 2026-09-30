-- Featured Boost spec: service ads can carry an external website (the card and
-- detail page show a "Visit website" button), and a boosted service advert also
-- appears in the prime homepage carousel. The carousel reads `advertisements`
-- only, so fulfilment mirrors the service ad into an `advertisements` row tied
-- back through service_ad_id; boost-expire deactivates it when the boost ends.

alter table public.service_ads
  add column if not exists destination_url text;

alter table public.advertisements
  add column if not exists service_ad_id uuid references public.service_ads(id) on delete cascade;

-- NULLs are distinct in Postgres unique indexes, so banner rows without a
-- service link coexist fine with at most one mirror row per service ad.
create unique index if not exists advertisements_service_ad_id_key
  on public.advertisements (service_ad_id);