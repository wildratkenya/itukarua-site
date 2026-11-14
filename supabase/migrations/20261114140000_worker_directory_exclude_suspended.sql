-- Migration: Exclude suspended profiles from public_worker_directory
--
-- The by-id directory view only filtered on deleted_at and still exposed
-- suspended accounts. Add coalesce(p.suspended, false) = false so suspended
-- jobseekers no longer appear in the directory (matching the anonymous
-- public_worker_listing view).
--
-- Column list is unchanged and stays card-safe: no phone, email,
-- whatsapp_number, resume, national_id or certificates. Grants remain
-- authenticated-only (anon already revoked in 20261103100000).
--
-- Includes runnable BEGIN; ... ROLLBACK; verification tests (run separately
-- after the DDL commits) that prove a suspended user does not appear in
-- public_worker_directory while an active user does, and that no contact column
-- leaks through the view. Test data is rolled back; the view definition persists.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Recreate the view with the suspended filter.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.public_worker_directory;

CREATE VIEW public.public_worker_directory AS
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
  and coalesce(p.suspended, false) = false;

comment on view public.public_worker_directory is
  'Signed-in card lookup for any role. Excludes suspended accounts. No contact fields, documents, consent or billing flags.';

revoke all on public.public_worker_directory from public;
revoke all on public.public_worker_directory from anon;
grant select on public.public_worker_directory to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Verification tests (run separately; each in its own BEGIN; ... ROLLBACK;
--    so a test failure never rolls back the DDL above).
-- ---------------------------------------------------------------------------
COMMIT;

-- Seed test users directly into profiles (profiles.id has no FK to auth.users
-- in this schema, so INSERT works without an auth row).
BEGIN;
INSERT INTO public.profiles (id, role, full_name, suspended, deleted_at, allow_contact_display, terms_accepted, accepted_terms_at, terms_version, privacy_version, age_attested_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'jobseeker', 'Suspended Worker', true, null, true, true, now(), '2.0', '2.0', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'jobseeker', 'Active Worker', false, null, true, true, now(), '2.0', '2.0', now())
ON CONFLICT (id) DO NOTHING;
ROLLBACK;

-- T1: suspended jobseeker must NOT appear in the directory.
BEGIN;
DO $$
DECLARE
  found int;
begin
  select count(*)
  into found
  from public.public_worker_directory
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  if found > 0 then
    raise exception 'TEST FAIL: suspended profile still appears in public_worker_directory';
  end if;
  raise notice 'TEST PASS: suspended profile excluded from public_worker_directory';
end;
$$ language plpgsql;
ROLLBACK;

-- T2: active jobseeker must still appear in the directory.
BEGIN;
DO $$
DECLARE
  found int;
begin
  select count(*)
  into found
  from public.public_worker_directory
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  if found <> 1 then
    raise exception 'TEST FAIL: active profile missing from public_worker_directory';
  end if;
  raise notice 'TEST PASS: active profile present in public_worker_directory';
end;
$$ language plpgsql;
ROLLBACK;

-- T3: no contact column may be exposed by the view.
BEGIN;
DO $$
DECLARE
  leaked text[];
begin
  select array_agg(column_name)
  into leaked
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'public_worker_directory'
    and column_name = any (array['phone','email','whatsapp_number','whatsapp','resume','resume_url','national_id','certificates']);

  if leaked is not null and array_length(leaked, 1) > 0 then
    raise exception 'TEST FAIL: contact columns leaked in public_worker_directory: %', leaked;
  end if;
  raise notice 'TEST PASS: no contact columns exposed by public_worker_directory';
end;
$$ language plpgsql;
ROLLBACK;
