-- Track featured-boost renewal notices so each boost cycle is emailed exactly once.
-- The unique (item_table, item_id, boost_until) prevents duplicate notices for a
-- given window; a renewal extends boost_until, creating a new row for the next cycle.

create table if not exists public.boost_renewal_notices (
  id uuid primary key default gen_random_uuid(),
  item_table text not null check (item_table in ('advertisements', 'service_ads', 'jobs')),
  item_id uuid not null,
  boost_until timestamp with time zone not null,
  sent_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  unique (item_table, item_id, boost_until)
);

alter table public.boost_renewal_notices enable row level security;