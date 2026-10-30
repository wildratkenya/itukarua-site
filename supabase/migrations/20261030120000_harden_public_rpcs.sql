-- Harden SECURITY DEFINER functions that were executable by anon.
--
-- admin_newsletter: had no caller check and no anon revoke, so anyone with the
-- public anon key could list, add or delete newsletter subscribers.
-- create_user_profile: anon-executable and unchecked, so anyone could upsert
-- another user's profile row (contact details, resume) and force verified/paid.
-- admin_reset_password: guarded internally, but anon had no reason to reach it.
--
-- Also removes the "any authenticated user" read policy on
-- newsletter_subscribers; the list now moves only through the guarded RPC.

begin;

create or replace function public.admin_newsletter(
  action text,
  p_email text default null,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.current_actor_is_privileged() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if action = 'list' then
    select jsonb_agg(
      jsonb_build_object('email', email, 'name', name, 'created_at', created_at)
      order by created_at desc
    )
      into result
      from newsletter_subscribers;
    return coalesce(result, '[]'::jsonb);
  elsif action = 'add' then
    insert into newsletter_subscribers (email, name)
    values (lower(trim(p_email)), coalesce(p_name, ''));
    return '"ok"'::jsonb;
  elsif action = 'delete' then
    delete from newsletter_subscribers where email = lower(trim(p_email));
    return '"ok"'::jsonb;
  end if;

  return '"unknown action"'::jsonb;
end;
$$;

create or replace function public.create_user_profile(
  p_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_role text,
  p_location text,
  p_skills text,
  p_resume text,
  p_county text default null,
  p_subcounty text default null,
  p_profile_image text default null,
  p_ratings_enabled boolean default null,
  p_terms_accepted boolean default false,
  p_data_sharing_consent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only staff provisioning (service role or an admin JWT) may write another
  -- user's row. Self-signup goes through the table insert policy instead.
  if not public.current_actor_is_privileged() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  insert into public.profiles (
    id, full_name, email, phone, role, location, county, subcounty, skills,
    resume, profile_image, ratings_enabled, verified, registration_paid,
    terms_accepted, data_sharing_consent, accepted_terms_at
  )
  values (
    p_id, p_full_name, p_email, p_phone, p_role, p_location, p_county,
    p_subcounty, p_skills, p_resume, coalesce(p_profile_image, ''),
    coalesce(p_ratings_enabled, false), true, true, p_terms_accepted,
    p_data_sharing_consent,
    case when p_terms_accepted then now() else null end
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    location = excluded.location,
    county = excluded.county,
    subcounty = excluded.subcounty,
    skills = excluded.skills,
    resume = excluded.resume,
    profile_image = case when p_profile_image is not null then p_profile_image else profiles.profile_image end,
    ratings_enabled = case when p_ratings_enabled is not null then p_ratings_enabled else profiles.ratings_enabled end,
    terms_accepted = case when p_terms_accepted then true else profiles.terms_accepted end,
    data_sharing_consent = case when p_data_sharing_consent then true else profiles.data_sharing_consent end,
    accepted_terms_at = case when p_terms_accepted and not profiles.terms_accepted then now() else profiles.accepted_terms_at end,
    verified = true,
    registration_paid = true;

  return p_id;
end;
$$;

-- Function EXECUTE is granted to PUBLIC by default, so revoking anon alone is
-- not enough.
revoke all on function public.admin_newsletter(text, text, text) from public;
revoke all on function public.admin_newsletter(text, text, text) from anon;
grant execute on function public.admin_newsletter(text, text, text) to authenticated, service_role;

revoke all on function public.create_user_profile(uuid, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean) from public;
revoke all on function public.create_user_profile(uuid, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean) from anon;
grant execute on function public.create_user_profile(uuid, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean) to authenticated, service_role;

revoke all on function public.admin_reset_password(uuid, text) from public;
revoke all on function public.admin_reset_password(uuid, text) from anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated, service_role;

drop policy if exists "Authenticated users can view subscribers" on public.newsletter_subscribers;

commit;
