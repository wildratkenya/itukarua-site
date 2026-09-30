-- Service ad analytics + social media links.
-- Adds per-ad view/click counters and social profile links (30-day plan perk).

alter table public.service_ads
  add column if not exists views_count integer not null default 0,
  add column if not exists clicks_count integer not null default 0,
  add column if not exists social_links jsonb;

-- View counter: any viewer may bump it (SECURITY DEFINER, like increment_job_views).
create or replace function public.increment_service_ad_views(p_ad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_ads set views_count = coalesce(views_count, 0) + 1 where id = p_ad_id;
end;
$$;

alter function public.increment_service_ad_views(uuid) owner to postgres;

-- Click counter: bumps on contact / WhatsApp / social actions.
create or replace function public.increment_service_ad_clicks(p_ad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_ads set clicks_count = coalesce(clicks_count, 0) + 1 where id = p_ad_id;
end;
$$;

alter function public.increment_service_ad_clicks(uuid) owner to postgres;

grant execute on function public.increment_service_ad_views(uuid) to anon, authenticated, service_role;
grant execute on function public.increment_service_ad_clicks(uuid) to anon, authenticated, service_role;