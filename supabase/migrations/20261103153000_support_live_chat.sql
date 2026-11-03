alter table public.support_tickets
  add column if not exists conversation_id uuid;

create table if not exists public.support_admin_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen timestamptz not null default now()
);

create index if not exists support_tickets_conversation_id_idx
  on public.support_tickets (conversation_id);

alter table public.support_admin_presence enable row level security;

grant select, insert, update on public.support_admin_presence to authenticated;

drop policy if exists "support admin presence read" on public.support_admin_presence;
create policy "support admin presence read"
  on public.support_admin_presence for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

drop policy if exists "support admin presence write" on public.support_admin_presence;
create policy "support admin presence write"
  on public.support_admin_presence for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

drop policy if exists "support admin presence update" on public.support_admin_presence;
create policy "support admin presence update"
  on public.support_admin_presence for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant all on public.support_admin_presence to service_role;
