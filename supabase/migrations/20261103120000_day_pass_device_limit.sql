-- Consent-only jobseeker listing + day-pass device cap.
--
-- 1. public_worker_listing now excludes jobseekers who have not enabled
--    contact display. The filter lives in the view itself so the public
--    PostgREST endpoint cannot enumerate people who opted out.
-- 2. A day-pass token works on at most three distinct browsers/devices. The
--    browser sends a random id that never leaves the device; only its hash is
--    stored. Clearing site data mints a new id, so this is a sharing speed
--    bump, not a hard identity control.

begin;

-- ─── 1. Consent-only listing ───────────────────────────────────────────────

drop view if exists public.public_worker_listing;

create view public.public_worker_listing as
select
  p.id,
  p.full_name,
  p.profile_image,
  p.rating,
  p.reviews_count,
  p.skills,
  p.qualifications,
  p.experience,
  p.location,
  p.county,
  p.subcounty,
  p.role,
  p.verified,
  p.created_at,
  p.updated_at,
  p.likes_count,
  p.dislikes_count,
  p.profile_views,
  p.is_featured,
  p.ratings_enabled,
  p.subscription_expires_at,
  p.allow_contact_display
from public.profiles p
where p.deleted_at is null
  and coalesce(p.suspended, false) = false
  and p.role = 'jobseeker'
  and p.allow_contact_display is true;

comment on view public.public_worker_listing is
  'Anonymous jobseeker listing. Only workers who enabled contact display. Card fields only: no contact details, documents, consent or billing flags.';

revoke all on public.public_worker_listing from public;
grant select on public.public_worker_listing to anon, authenticated;

-- Job-match alerts must still reach workers who opted out of the public
-- listing, so they read a minimal SECURITY DEFINER projection instead of the
-- filtered view.
create or replace function public.get_jobseeker_notification_targets()
returns table (id uuid, skills text, county text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.skills, p.county
  from public.profiles p
  where p.deleted_at is null
    and coalesce(p.suspended, false) = false
    and p.role = 'jobseeker';
$$;

revoke all on function public.get_jobseeker_notification_targets() from public;
revoke all on function public.get_jobseeker_notification_targets() from anon;
grant execute on function public.get_jobseeker_notification_targets() to authenticated, service_role;

-- ─── 2. Day-pass device cap ────────────────────────────────────────────────

create table if not exists public.day_pass_devices (
  payment_id uuid not null references public.payments(id) on delete cascade,
  device_hash text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (payment_id, device_hash)
);

alter table public.day_pass_devices enable row level security;
revoke all on table public.day_pass_devices from public;
revoke all on table public.day_pass_devices from anon, authenticated;

comment on table public.day_pass_devices is
  'Distinct browsers that redeemed a day-pass token. Only a hash of the random client device id is stored.';

insert into public.platform_settings (key, value, updated_at)
values ('top_rated_pass_devices', 3, now())
on conflict (key) do nothing;

-- Returns ok for an already-known device, registers a new one while there is
-- room, and refuses once the cap is reached. The advisory lock serialises
-- concurrent registrations for the same payment so two new devices cannot
-- both squeeze past the cap.
create or replace function public.register_day_pass_device(
  p_payment_id uuid,
  p_device_id text,
  p_max_devices integer default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_hash text;
  v_count integer;
begin
  p_device_id := btrim(coalesce(p_device_id, ''));

  if p_payment_id is null
     or p_device_id !~ '^[A-Za-z0-9_-]{16,128}$'
  then
    return json_build_object('ok', false, 'reason', 'missing_device');
  end if;

  if p_max_devices is null then
    select value::int into v_max
    from public.platform_settings
    where key = 'top_rated_pass_devices';
  else
    v_max := p_max_devices;
  end if;
  v_max := greatest(1, coalesce(v_max, 3));

  v_hash := md5(p_device_id);

  perform pg_advisory_xact_lock(hashtextextended(p_payment_id::text, 0));

  update public.day_pass_devices
  set last_seen = now()
  where payment_id = p_payment_id
    and device_hash = v_hash;

  if found then
    return json_build_object('ok', true, 'limit', v_max);
  end if;

  select count(*) into v_count
  from public.day_pass_devices
  where payment_id = p_payment_id;

  if v_count >= v_max then
    return json_build_object('ok', false, 'reason', 'device_limit', 'limit', v_max);
  end if;

  insert into public.day_pass_devices (payment_id, device_hash)
  values (p_payment_id, v_hash)
  on conflict (payment_id, device_hash) do nothing;

  return json_build_object('ok', true, 'limit', v_max);
end;
$$;

revoke all on function public.register_day_pass_device(uuid, text, integer) from public;
revoke all on function public.register_day_pass_device(uuid, text, integer) from anon, authenticated;
grant execute on function public.register_day_pass_device(uuid, text, integer) to service_role;

-- ─── 3. Device-aware pass RPCs ─────────────────────────────────────────────

drop function if exists public.get_top_rated_pass(text);

create function public.get_top_rated_pass(
  p_token text,
  p_device_id text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_ids uuid[];
  v_profiles json;
  v_device json;
begin
  if p_token is null or length(btrim(p_token)) < 8 then
    return '{"allowed":false,"reason":"invalid"}'::json;
  end if;

  if not public.consume_rate_limit('top_rated_pass_lookup', public.request_actor(), 60, 60) then
    return '{"allowed":false,"reason":"rate_limited"}'::json;
  end if;

  select * into v_payment
  from public.payments
  where token = upper(btrim(p_token))
    and payment_type = 'top_rated_day_pass'
  limit 1;

  if not found or v_payment.status <> 'completed' then
    return '{"allowed":false,"reason":"invalid"}'::json;
  end if;

  if v_payment.access_expires_at is null or v_payment.access_expires_at <= now() then
    return json_build_object(
      'allowed', false,
      'reason', 'expired',
      'expires_at', v_payment.access_expires_at
    );
  end if;

  v_device := public.register_day_pass_device(v_payment.id, p_device_id);
  if coalesce((v_device->>'ok')::boolean, false) is not true then
    return json_build_object(
      'allowed', false,
      'reason', coalesce(v_device->>'reason', 'device_limit'),
      'limit', coalesce((v_device->>'limit')::int, 3),
      'expires_at', v_payment.access_expires_at
    );
  end if;

  select array_agg(value::uuid)
  into v_ids
  from jsonb_array_elements_text(
    coalesce(v_payment.metadata -> 'profile_ids', '[]'::jsonb)
  ) as value;

  select coalesce(
    json_agg(
      json_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'profile_image', p.profile_image,
        'rating', p.rating,
        'reviews_count', p.reviews_count,
        'skills', p.skills,
        'location', p.location,
        'county', p.county,
        'subcounty', p.subcounty
      )
      order by p.rating desc nulls last, p.likes_count desc nulls last
    ),
    '[]'::json
  )
  into v_profiles
  from public.profiles p
  where p.id = any(coalesce(v_ids, '{}'::uuid[]))
    and p.deleted_at is null
    and coalesce(p.suspended, false) = false
    and p.allow_contact_display is true;

  return json_build_object(
    'allowed', true,
    'expires_at', v_payment.access_expires_at,
    'devices_limit', coalesce((v_device->>'limit')::int, 3),
    'profiles', v_profiles
  );
end;
$$;

revoke all on function public.get_top_rated_pass(text, text) from public;
grant execute on function public.get_top_rated_pass(text, text) to anon, authenticated, service_role;

drop function if exists public.get_top_rated_pass_contact(text, uuid);

create function public.get_top_rated_pass_contact(
  p_token text,
  p_profile_id uuid,
  p_device_id text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_ids uuid[];
  v_profile public.profiles%rowtype;
  v_device json;
begin
  if p_token is null or length(btrim(p_token)) < 8 then
    return '{"allowed":false,"reason":"invalid"}'::json;
  end if;

  if p_profile_id is null then
    return '{"allowed":false,"reason":"missing"}'::json;
  end if;

  -- A bearer token is guessable only through the API, so throttle attempts.
  if not public.consume_rate_limit('top_rated_pass_contact', public.request_actor(), 60, 300) then
    return '{"allowed":false,"reason":"rate_limited"}'::json;
  end if;

  select * into v_payment
  from public.payments
  where token = upper(btrim(p_token))
    and payment_type = 'top_rated_day_pass'
  limit 1;

  if not found or v_payment.status <> 'completed' then
    return '{"allowed":false,"reason":"invalid"}'::json;
  end if;

  if v_payment.access_expires_at is null or v_payment.access_expires_at <= now() then
    return json_build_object(
      'allowed', false,
      'reason', 'expired',
      'expires_at', v_payment.access_expires_at
    );
  end if;

  v_device := public.register_day_pass_device(v_payment.id, p_device_id);
  if coalesce((v_device->>'ok')::boolean, false) is not true then
    return json_build_object(
      'allowed', false,
      'reason', coalesce(v_device->>'reason', 'device_limit'),
      'limit', coalesce((v_device->>'limit')::int, 3),
      'expires_at', v_payment.access_expires_at
    );
  end if;

  select array_agg(value::uuid)
  into v_ids
  from jsonb_array_elements_text(
    coalesce(v_payment.metadata -> 'profile_ids', '[]'::jsonb)
  ) as value;

  if not (p_profile_id = any(coalesce(v_ids, '{}'::uuid[]))) then
    return '{"allowed":false,"reason":"not_in_pass"}'::json;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
    and coalesce(suspended, false) = false;

  if not found then
    return '{"allowed":false,"reason":"missing"}'::json;
  end if;

  -- Consent is checked at redemption time, so a worker who opts out after the
  -- purchase immediately stops being revealed.
  if v_profile.allow_contact_display is not true then
    return '{"allowed":false,"reason":"opted_out"}'::json;
  end if;

  return json_build_object(
    'allowed', true,
    'expires_at', v_payment.access_expires_at,
    'full_name', v_profile.full_name,
    'contact', json_build_object(
      'phone', v_profile.phone,
      'email', v_profile.email,
      'whatsapp', v_profile.whatsapp_number,
      'location', v_profile.location,
      'county', v_profile.county,
      'subcounty', v_profile.subcounty
    )
  );
end;
$$;

revoke all on function public.get_top_rated_pass_contact(text, uuid, text) from public;
grant execute on function public.get_top_rated_pass_contact(text, uuid, text) to anon, authenticated, service_role;

commit;
