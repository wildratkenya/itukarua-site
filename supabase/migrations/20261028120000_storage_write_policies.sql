-- Restrict writes to the jobs/adverts storage buckets.
--
-- Why: "Auth Insert", "Auth Update" and "Auth Delete" were created with
-- `to public` and only checked bucket_id, so any anonymous caller could upload,
-- overwrite or delete any file in both buckets. The other policies were aimed at
-- "authenticated" but still let any signed-in user modify another user's object.
--
-- New shape:
--   insert  signed-in users for both buckets; anon may upload to adverts only
--           under a UUID folder, because signup uploads an avatar/certificates
--           before the confirmation email creates a session;
--   update  only the uploader, the owner of the UUID folder, or staff;
--   delete  only the uploader, the owner of the UUID folder, or staff.
--
-- The folder check exists because signup uploads run anonymously, so those
-- objects have a NULL owner and the user could not replace their own avatar
-- afterwards. Folders are named by account id, so the rule still binds a user
-- to their own files.
--
-- Public read is unchanged: the site serves these images directly.

drop policy if exists "Auth Insert" on storage.objects;
drop policy if exists "Auth Update" on storage.objects;
drop policy if exists "Auth Delete" on storage.objects;
drop policy if exists "Allow authenticated inserts" on storage.objects;
drop policy if exists "Auth Upload Jobs" on storage.objects;
drop policy if exists "Auth Upload Adverts" on storage.objects;
drop policy if exists "Authenticated users can delete adverts" on storage.objects;
drop policy if exists "Authenticated users can update adverts" on storage.objects;
drop policy if exists "Authenticated users can upload to adverts" on storage.objects;
drop policy if exists "Allow users to delete own objects" on storage.objects;
drop policy if exists "Allow users to update own objects" on storage.objects;

create policy "jobs and adverts inserts by signed-in users"
  on storage.objects
  as permissive
  for insert
  to authenticated
  with check (bucket_id = any (array['jobs'::text, 'adverts'::text]));

-- Signup uploads (avatar, certificates) happen before email confirmation, so
-- there may be no session yet. Keep that path open, but only inside a UUID
-- folder — the account id the client uploads under — so anonymous callers
-- cannot drop files at the bucket root or into a shared folder.
create policy "adverts signup uploads in uuid folders"
  on storage.objects
  as permissive
  for insert
  to anon
  with check (
    bucket_id = 'adverts'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

create policy "bucket owners update own objects"
  on storage.objects
  as permissive
  for update
  to authenticated
  using (
    bucket_id = any (array['jobs'::text, 'adverts'::text])
    and (
      owner = auth.uid()
      or (storage.foldername(name))[1] = auth.uid()::text
      or public.current_actor_is_privileged()
    )
  )
  with check (
    bucket_id = any (array['jobs'::text, 'adverts'::text])
    and (
      owner = auth.uid()
      or (storage.foldername(name))[1] = auth.uid()::text
      or public.current_actor_is_privileged()
    )
  );

create policy "bucket owners delete own objects"
  on storage.objects
  as permissive
  for delete
  to authenticated
  using (
    bucket_id = any (array['jobs'::text, 'adverts'::text])
    and (
      owner = auth.uid()
      or (storage.foldername(name))[1] = auth.uid()::text
      or public.current_actor_is_privileged()
    )
  );
