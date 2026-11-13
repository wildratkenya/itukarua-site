-- Add national_id to profiles and expose in get_profile_contact for due diligence
--
-- Why: Due diligence for jobseekers requires verifying their National ID,
-- resume, and certificates. National ID is PII and is only accessible to
-- the profile owner, privileged admins, and employers who unlock contact.

begin;

-- 1. Add national_id column to public.profiles
alter table public.profiles
  add column if not exists national_id text;

comment on column public.profiles.national_id is
  'National ID number for jobseeker identity verification and due diligence.';

-- 2. Update create_user_profile to accept p_national_id
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
  p_data_sharing_consent boolean default false,
  p_national_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_actor_is_privileged() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  insert into public.profiles (
    id, full_name, email, phone, role, location, county, subcounty, skills,
    resume, profile_image, ratings_enabled, verified, registration_paid,
    terms_accepted, data_sharing_consent, accepted_terms_at, national_id
  )
  values (
    p_id, p_full_name, p_email, p_phone, p_role, p_location, p_county,
    p_subcounty, p_skills, p_resume, coalesce(p_profile_image, ''),
    coalesce(p_ratings_enabled, false), true, true, p_terms_accepted,
    p_data_sharing_consent,
    case when p_terms_accepted then now() else null end,
    p_national_id
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
    profile_image = case when excluded.profile_image <> '' then excluded.profile_image else profiles.profile_image end,
    ratings_enabled = coalesce(excluded.ratings_enabled, profiles.ratings_enabled),
    national_id = coalesce(excluded.national_id, profiles.national_id),
    updated_at = now();

  return p_id;
end;
$$;

-- 3. Update get_profile_contact to include national_id for due diligence
create or replace function public.get_profile_contact(
  p_profile_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_user uuid := auth.uid();
  v_allowed boolean := false;
  v_expires timestamptz;
begin
  if p_profile_id is null then
    return '{"allowed":false,"reason":"missing"}'::json;
  end if;

  select * into v_profile from public.profiles where id = p_profile_id;
  if not found then
    return '{"allowed":false,"reason":"missing"}'::json;
  end if;

  if v_profile.allow_contact_display is not true then
    return '{"allowed":false,"reason":"opted_out"}'::json;
  end if;

  if v_user = v_profile.id then
    v_allowed := true;
  end if;

  if not v_allowed and v_user is not null then
    select exists (
      select 1 from public.profiles p
      where p.id = v_user and p.role in ('admin', 'super_admin')
    ) into v_allowed;
  end if;

  if not v_allowed and v_user is not null then
    select exists (
      select 1 from public.payments pm
      where pm.user_id = v_user
        and pm.payment_type = 'contact_access'
        and pm.related_profile_id = v_profile.id
        and pm.status = 'completed'
        and pm.access_expires_at is not null
        and pm.access_expires_at > now()
    ) into v_allowed;
    if v_allowed then
      select max(pm.access_expires_at)
        into v_expires
        from public.payments pm
        where pm.user_id = v_user
          and pm.payment_type = 'contact_access'
          and pm.related_profile_id = v_profile.id
          and pm.status = 'completed'
          and pm.access_expires_at > now();
    end if;
  end if;

  if not v_allowed and v_user is not null then
    select exists (
      select 1 from public.profile_roles pr
      where pr.user_id = v_user
        and pr.paid
        and pr.role = 'employer'
        and pr.expires_at is not null
        and pr.expires_at > now()
    ) into v_allowed;
    if v_allowed then
      select max(pr.expires_at)
        into v_expires
        from public.profile_roles pr
        where pr.user_id = v_user
          and pr.paid
          and pr.role = 'employer'
          and pr.expires_at > now();
    end if;
  end if;

  if not v_allowed and v_user is not null then
    select exists (
      select 1 from public.profiles p
      where p.id = v_user
        and p.registration_paid
        and p.role in ('employer', 'admin', 'super_admin')
        and p.subscription_expires_at is not null
        and p.subscription_expires_at > now()
    ) into v_allowed;
    if v_allowed then
      select p.subscription_expires_at
        into v_expires
        from public.profiles p
        where p.id = v_user;
    end if;
  end if;

  if not v_allowed and v_user is not null then
    if exists (
      select 1 from public.payments pm
      where pm.user_id = v_user
        and pm.payment_type = 'contact_access'
        and pm.related_profile_id = v_profile.id
        and pm.status = 'completed'
    ) then
      return '{"allowed":false,"reason":"expired"}'::json;
    end if;
  end if;

  if not v_allowed then
    return '{"allowed":false,"reason":"locked"}'::json;
  end if;

  return json_build_object(
    'allowed', true,
    'expires_at', v_expires,
    'contact', json_build_object(
      'phone', v_profile.phone,
      'email', v_profile.email,
      'whatsapp', v_profile.whatsapp_number,
      'location', v_profile.location,
      'county', v_profile.county,
      'subcounty', v_profile.subcounty,
      'national_id', v_profile.national_id
    ),
    'certificates', v_profile.certificates,
    'resume', v_profile.resume,
    'national_id', v_profile.national_id
  );
end;
$$;

commit;

