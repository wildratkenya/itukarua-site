alter table public.support_tickets
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);

grant select, update on public.support_tickets to authenticated;

drop policy if exists "support tickets admin select" on public.support_tickets;
create policy "support tickets admin select"
  on public.support_tickets for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "support tickets admin update" on public.support_tickets;
create policy "support tickets admin update"
  on public.support_tickets for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
    )
  );
