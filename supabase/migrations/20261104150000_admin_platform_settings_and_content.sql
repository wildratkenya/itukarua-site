create table if not exists public.platform_content (
  key text primary key,
  content text not null,
  version text not null default '1.0',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.platform_content enable row level security;

drop policy if exists "public read platform content" on public.platform_content;
create policy "public read platform content"
  on public.platform_content for select
  using (true);

drop policy if exists "super admins manage platform content" on public.platform_content;
create policy "super admins manage platform content"
  on public.platform_content for all
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'super_admin'
  ));

grant select on public.platform_content to anon, authenticated;
grant all on public.platform_content to authenticated, service_role;
