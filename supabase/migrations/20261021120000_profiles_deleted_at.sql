-- Add soft-delete support to profiles so the admin "Trash" feature works.
--
-- The admin UI PATCHes profiles.deleted_at to move a user to the trash, but the
-- column never existed, so PostgREST answered 400 (PGRST204) and the user stayed
-- in the active list.

alter table public.profiles
  add column if not exists deleted_at timestamptz;

create index if not exists idx_profiles_deleted_at
  on public.profiles (deleted_at);

comment on column public.profiles.deleted_at is
  'Timestamp the profile was moved to trash; null means active.';
