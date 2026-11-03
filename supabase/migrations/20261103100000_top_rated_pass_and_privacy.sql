-- Top Rated Day Pass + public-directory privacy fixes.
--
-- 1. public_worker_listing is the only anonymous listing surface. It is
--    jobseeker-only, hides suspended/erased accounts, and carries card fields
--    only.
-- 2. public_worker_directory loses the internal consent/billing flags and is
--    authenticated-only. It remains the by-id lookup for bidder/sender cards.
-- 3. Reviews get a SECURITY DEFINER read path so anonymous visitors can see
--    the same reviewer name/avatar signed-in visitors see.
-- 4. Profile view counts are deduplicated per viewer per profile per day.
-- 5. Top Rated Day Pass: KES 100 buys 24h of contact details for every worker
--    in the top-rated snapshot stored on the payment row. The bearer token is
--    redeemable without an account and never unlocks CVs or certificates.

begin;

-- ─── 1. Anonymous listing view ─────────────────────────────────────────────

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
  and p.role = 'jobseeker';

comment on view public.public_worker_listing is
  'Anonymous jobseeker listing. Card fields only: no contact details, documents, consent or billing flags.';

revoke all on public.public_worker_listing from public;
grant select on public.public_worker_listing to anon, authenticated;

-- ─── 2. Trim the by-id directory and stop anonymous enumeration ────────────

drop view if exists public.public_worker_directory;

create view public.public_worker_directory as
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
where p.deleted_at is null;

comment on view public.public_worker_directory is
  'Signed-in card lookup for any role. No contact fields, documents, consent or billing flags.';

revoke all on public.public_worker_directory from public;
revoke all on public.public_worker_directory from anon;
grant select on public.public_worker_directory to authenticated;

-- ─── 3. Public review cards ────────────────────────────────────────────────

create or replace function public.get_profile_reviews(p_profile_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', r.id,
        'rating', r.rating,
        'comment', r.comment,
        'created_at', r.created_at,
        'reviewer', json_build_object(
          'full_name', p.full_name,
          'profile_image', p.profile_image
        )
      )
      order by r.created_at desc
    ),
    '[]'::json
  )
  from public.profile_reviews r
  left join public.profiles p on p.id = r.reviewer_id
  where r.profile_id = p_profile_id;
$$;

revoke all on function public.get_profile_reviews(uuid) from public;
grant execute on function public.get_profile_reviews(uuid) to anon, authenticated, service_role;

-- ─── 4. Deduplicated profile view counter ──────────────────────────────────

create or replace function public.increment_profile_views(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p.deleted_at is null
  ) then
    return;
  end if;

  -- One count per viewer per profile per UTC day. Consumers of the counter are
  -- display-only, so throttling is preferable to letting the anon key inflate it.
  if not public.consume_rate_limit(
    'profile_view:' || p_profile_id::text,
    public.request_actor(),
    1,
    86400
  ) then
    return;
  end if;

  update public.profiles
  set profile_views = coalesce(profile_views, 0) + 1
  where id = p_profile_id;

  insert into public.profile_views_log (profile_id, viewer_id)
  values (p_profile_id, auth.uid());
end;
$$;

grant execute on function public.increment_profile_views(uuid) to anon, authenticated, service_role;

-- ─── 5. Top Rated Day Pass ─────────────────────────────────────────────────

insert into public.platform_settings (key, value, updated_at)
values
  ('top_rated_pass_fee', 100, now()),
  ('top_rated_pass_hours', 24, now())
on conflict (key) do nothing;

-- Validate a day-pass token and return the workers covered by it. Used by the
-- day-pass page and by the popup to mark which top-rated workers are unlocked.
-- Volatile, not stable: every lookup consumes a rate-limit counter.
create or replace function public.get_top_rated_pass(p_token text)
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
    'profiles', v_profiles
  );
end;
$$;

revoke all on function public.get_top_rated_pass(text) from public;
grant execute on function public.get_top_rated_pass(text) to anon, authenticated, service_role;

-- Reveal contact details only for a worker inside the purchased snapshot.
-- CVs and certificates are deliberately absent: they stay behind sign-in.
create or replace function public.get_top_rated_pass_contact(
  p_token text,
  p_profile_id uuid
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

revoke all on function public.get_top_rated_pass_contact(text, uuid) from public;
grant execute on function public.get_top_rated_pass_contact(text, uuid) to anon, authenticated, service_role;

commit;
