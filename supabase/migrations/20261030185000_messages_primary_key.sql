begin;

-- messages had no primary key, so it published to supabase_realtime without a
-- usable replica identity and every DELETE failed with SQLSTATE 55000. That
-- blocked account erasure and admin cleanup. The id column is already generated
-- and unique, so make it the key.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.messages'::regclass and contype = 'p'
  ) then
    alter table public.messages add constraint messages_pkey primary key (id);
  end if;
end $$;

commit;
