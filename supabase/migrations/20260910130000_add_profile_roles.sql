-- One account can hold multiple paid role entitlements (jobseeker / employer /
-- advertiser), each owned and bought separately. A role entitlement is served
-- only if it exists here AND is paid and unexpired.
create table if not exists public.profile_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('jobseeker', 'employer', 'advertiser')),
  paid boolean not null default true,
  expires_at timestamptz,
  token_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.profile_roles owner to postgres;

create index if not exists profile_roles_role_idx on public.profile_roles (role);

alter table public.profile_roles enable row level security;

drop policy if exists "profile_roles_owner_select" on public.profile_roles;
create policy "profile_roles_owner_select"
  on public.profile_roles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "profile_roles_owner_insert" on public.profile_roles;
create policy "profile_roles_owner_insert"
  on public.profile_roles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profile_roles_owner_update" on public.profile_roles;
create policy "profile_roles_owner_update"
  on public.profile_roles
  for update
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update on table public.profile_roles to anon;
grant select, insert, update on table public.profile_roles to authenticated;
grant all on table public.profile_roles to service_role;

-- Backfill: seed every existing profile's current role as an entitlement.
-- jobseeker = free entry (paid=false). employer/advertiser inherit the profile's
-- registration_paid + subscription_expires_at if present.
insert into public.profile_roles (user_id, role, paid, expires_at, token_days)
select
  p.id,
  p.role,
  case
    when p.role = 'jobseeker' then false
    else coalesce(p.registration_paid, false)
  end as paid,
  case when p.role = 'jobseeker' then null else p.subscription_expires_at end as expires_at,
  0 as token_days
from public.profiles p
where p.role in ('jobseeker', 'employer', 'advertiser')
  and p.suspended is not true
on conflict (user_id, role) do nothing;