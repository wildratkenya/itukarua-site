-- Certificates are private documents, not public assets.
--
-- Why: profiles.certificates held public URLs in the adverts bucket, and the
-- public_worker_directory view exposed the column to anonymous readers. Contact
-- details were gated by get_profile_contact, but certificates were readable by
-- anyone with the anon key, and the column survived in a view granted to anon.
--
-- Documents now live in a private bucket. A read is allowed only for the owner,
-- staff, or a viewer who passes the same entitlement checks get_profile_contact
-- uses (active contact_access payment, live employer role, legacy paid
-- employer). Reads happen through short-lived signed URLs.
--
-- Signup uploads certificates before email confirmation creates a session, so
-- the anon insert path stays open under the same UUID-folder rule as adverts.
-- The bucket is private, so an anonymous write does not make a document
-- readable.

begin;

-- ─── 1. Private bucket ─────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── 2. Entitlement check shared by storage policies ───────────────────────

create or replace function public.can_view_profile_documents(p_owner text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_profile public.profiles%rowtype;
  v_allowed boolean := false;
begin
  if v_uid is null or p_owner is null then
    return false;
  end if;

  -- Folders are account ids. Anything else has no owner to check against.
  if p_owner !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_owner := p_owner::uuid;

  if v_owner = v_uid or public.current_actor_is_privileged() then
    return true;
  end if;

  select * into v_profile from public.profiles where id = v_owner;
  if not found or v_profile.allow_contact_display is not true then
    return false;
  end if;

  -- Windowed per-contact purchase.
  select exists (
    select 1 from public.payments pm
    where pm.user_id = v_uid
      and pm.payment_type = 'contact_access'
      and pm.related_profile_id = v_owner
      and pm.status = 'completed'
      and pm.access_expires_at is not null
      and pm.access_expires_at > now()
  ) into v_allowed;

  -- Live Employer access.
  if not v_allowed then
    select exists (
      select 1 from public.profile_roles pr
      where pr.user_id = v_uid
        and pr.paid
        and pr.role = 'employer'
        and pr.expires_at is not null
        and pr.expires_at > now()
    ) into v_allowed;
  end if;

  -- Legacy paid employer mirror.
  if not v_allowed then
    select exists (
      select 1 from public.profiles p
      where p.id = v_uid
        and p.registration_paid
        and p.role in ('employer', 'admin', 'super_admin')
        and p.subscription_expires_at is not null
        and p.subscription_expires_at > now()
    ) into v_allowed;
  end if;

  return v_allowed;
end;
$$;

revoke all on function public.can_view_profile_documents(text) from public;
grant execute on function public.can_view_profile_documents(text) to authenticated, service_role;

-- ─── 3. Storage policies ───────────────────────────────────────────────────

drop policy if exists "documents read by owner or entitled viewer" on storage.objects;
create policy "documents read by owner or entitled viewer"
  on storage.objects
  as permissive
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_view_profile_documents((storage.foldername(name))[1])
    )
  );

drop policy if exists "documents insert own folder" on storage.objects;
create policy "documents insert own folder"
  on storage.objects
  as permissive
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_actor_is_privileged()
    )
  );

-- Signup uploads happen before the confirmation email creates a session.
drop policy if exists "documents signup uploads in uuid folders" on storage.objects;
create policy "documents signup uploads in uuid folders"
  on storage.objects
  as permissive
  for insert
  to anon
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

drop policy if exists "documents owners update own objects" on storage.objects;
create policy "documents owners update own objects"
  on storage.objects
  as permissive
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_actor_is_privileged()
    )
  )
  with check (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_actor_is_privileged()
    )
  );

drop policy if exists "documents owners delete own objects" on storage.objects;
create policy "documents owners delete own objects"
  on storage.objects
  as permissive
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_actor_is_privileged()
    )
  );

-- ─── 4. Public directory without the document column ───────────────────────

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
  p.registration_paid,
  p.subscription_expires_at,
  p.terms_accepted,
  p.data_sharing_consent,
  p.accepted_terms_at,
  p.suspended,
  p.allow_contact_display
from public.profiles p;

comment on view public.public_worker_directory is
  'Card-safe worker profile projection. No contact fields and no documents. '
  'Contact access is gated by get_profile_contact; documents by signed URLs.';

revoke all on public.public_worker_directory from anon;
grant select on public.public_worker_directory to anon;
grant select on public.public_worker_directory to authenticated;

commit;
