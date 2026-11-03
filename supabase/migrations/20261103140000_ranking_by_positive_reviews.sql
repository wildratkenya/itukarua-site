-- Rank top-rated workers by positive-review volume, not by average rating
-- alone. Previously rating, then thumbs-up clicks, then review count decided
-- the order, so a single 5-star review with a few likes outranked dozens of
-- good reviews. The new order matches the client comparator
-- compareByPositiveReviews: estimated positive reviews
-- (reviews_count * (rating - 1) / 4), then rating, then review count, then
-- likes.

begin;

create or replace function public.get_top_rated_pass(
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
      order by
        (coalesce(p.reviews_count, 0) * greatest(coalesce(p.rating, 0) - 1, 0) / 4.0) desc,
        p.rating desc nulls last,
        coalesce(p.reviews_count, 0) desc,
        coalesce(p.likes_count, 0) desc
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

commit;
