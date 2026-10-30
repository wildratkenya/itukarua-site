-- Ad click/impression telemetry for visitors who are not signed in.
--
-- The audit revoked direct INSERT on advert_analytics from anon, which made
-- every logged-out click fail with 401 and silently under-counted advertiser
-- reporting. This RPC is the supported write path: the ad must exist, the
-- event type is constrained, and each IP is limited to 120 events an hour.
-- The row holds no visitor identifier, so no consent record is involved.

create or replace function public.log_ad_event(p_ad_id uuid, p_event_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in ('click', 'impression') then
    raise exception 'invalid event type' using errcode = '22023';
  end if;

  if not exists (select 1 from public.advertisements where id = p_ad_id) then
    return;
  end if;

  perform public.consume_rate_limit('ad_event', public.request_actor(), 120, 3600);

  insert into public.advert_analytics (ad_id, event_type)
  values (p_ad_id, p_event_type);
end;
$$;

revoke all on function public.log_ad_event(uuid, text) from public;
grant execute on function public.log_ad_event(uuid, text) to anon, authenticated;
