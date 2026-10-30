begin;

-- Erased members disappear from the public directory even though the profile
-- row is kept (pseudonymised) as the anchor for financial records.
create or replace view public.public_worker_directory as
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
  p.registration_paid,
  p.subscription_expires_at,
  p.terms_accepted,
  p.data_sharing_consent,
  p.accepted_terms_at,
  p.suspended,
  p.allow_contact_display
from public.profiles p
where p.deleted_at is null;

revoke all on public.public_worker_directory from public;
grant select on public.public_worker_directory to anon, authenticated;

-- Erasure routine. Runs as service_role from the edge functions so it can touch
-- every table; returns the storage objects the caller still has to remove.
create or replace function public.purge_profile_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_email text;
  v_paths text[] := '{}';
begin
  if p_user_id is null then
    raise exception 'user id required';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('profile_missing', true, 'storage_paths', '[]'::jsonb);
  end if;

  v_email := lower(coalesce(v_profile.email, ''));
  if coalesce(v_profile.profile_image, '') <> '' then
    v_paths := array_append(v_paths, v_profile.profile_image);
  end if;
  if v_profile.certificates is not null then
    v_paths := v_paths || v_profile.certificates;
  end if;

  -- Personal content authored by the member.
  delete from public.bids where bidder_id = p_user_id
     or job_id in (select id from public.jobs where posted_by = p_user_id);
  delete from public.ratings where bidder_id = p_user_id or poster_id = p_user_id;
  delete from public.service_ratings where user_id = p_user_id;
  delete from public.profile_reviews where reviewer_id = p_user_id or profile_id = p_user_id;
  delete from public.profile_votes where voter_id = p_user_id or profile_id = p_user_id;
  delete from public.profile_views_log where profile_id = p_user_id or viewer_id = p_user_id;
  delete from public.direct_messages where sender_id = p_user_id;
  delete from public.conversation_participants where user_id = p_user_id;
  delete from public.messages where sender_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.job_otps where user_id = p_user_id;
  delete from public.profile_roles where user_id = p_user_id;
  delete from public.corporate_members where profile_id = p_user_id;
  delete from public.user_roles where id = p_user_id;
  if v_email <> '' then
    delete from public.newsletter_subscribers where lower(email) = v_email;
  end if;

  update public.jobs set awarded_bidder_id = null where awarded_bidder_id = p_user_id;
  delete from public.jobs where posted_by = p_user_id;

  -- Published listings stay up for the period they were paid for, detached from
  -- the member's identity.
  update public.service_ads set owner_id = null, owner_email = null where owner_id = p_user_id;
  update public.advertisements set owner_id = null, owner_email = null where owner_id = p_user_id;

  -- Payments are retained under the Tax Procedures Act; strip the phone number
  -- and the profile cross-reference so only the pseudonymous id remains.
  update public.payments set related_profile_id = null, mpesa_phone = null where user_id = p_user_id;

  update public.profiles set
    full_name = 'Deleted member',
    email = 'deleted+' || p_user_id::text || '@invalid.itukarua.co.ke',
    phone = null,
    whatsapp_number = null,
    profile_image = null,
    resume = null,
    certificates = null,
    qualifications = null,
    experience = null,
    skills = null,
    location = null,
    county = null,
    subcounty = null,
    marketing_opt_in = false,
    allow_contact_display = false,
    data_sharing_consent = false,
    ratings_enabled = false,
    verified = false,
    is_featured = false,
    suspended = true,
    deleted_at = now(),
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('profile_missing', false, 'email', v_email, 'storage_paths', to_jsonb(v_paths));
end;
$$;

revoke all on function public.purge_profile_data(uuid) from public;
revoke all on function public.purge_profile_data(uuid) from anon, authenticated;
grant execute on function public.purge_profile_data(uuid) to service_role;

commit;
