begin;

-- Evidence of which document versions a member accepted, plus the marketing
-- opt-in (default off, per Kenya DPA s.32 / GDPR Art.7).
alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists age_attested_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_version text;

-- Single-row record of the versions currently published on the site. The signup
-- trigger compares against this row, so updating the policies means publishing a
-- new version here instead of trusting whatever the browser sends.
create table if not exists public.consent_versions (
  id integer primary key,
  terms_version text not null,
  privacy_version text not null,
  updated_at timestamptz not null default now(),
  constraint consent_versions_singleton check (id = 1)
);

insert into public.consent_versions (id, terms_version, privacy_version)
values (1, '2.0', '2.0')
on conflict (id) do nothing;

alter table public.consent_versions enable row level security;
revoke all on public.consent_versions from public;
revoke all on public.consent_versions from anon, authenticated;
grant select on public.consent_versions to anon, authenticated;

drop policy if exists "consent versions are readable" on public.consent_versions;
create policy "consent versions are readable" on public.consent_versions
for select to anon, authenticated using (true);

create or replace function public.enforce_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms text;
  v_privacy text;
begin
  -- Staff and service-role provisioning flows set their own evidence.
  if public.current_actor_is_privileged() then
    return new;
  end if;

  select terms_version, privacy_version into v_terms, v_privacy
    from public.consent_versions where id = 1;

  if new.terms_accepted is not true then
    raise exception 'Terms and Conditions must be accepted before creating an account'
      using errcode = 'check_violation';
  end if;
  if new.accepted_terms_at is null or new.accepted_terms_at > now() + interval '5 minutes' then
    raise exception 'Terms acceptance timestamp is missing or invalid'
      using errcode = 'check_violation';
  end if;
  if coalesce(new.terms_version, '') <> coalesce(v_terms, '')
     or coalesce(new.privacy_version, '') <> coalesce(v_privacy, '') then
    raise exception 'Consent documents have changed; reload and accept the current versions'
      using errcode = 'check_violation';
  end if;
  if new.age_attested_at is null or new.age_attested_at > now() + interval '5 minutes' then
    raise exception 'You must confirm you are 18 or older'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_signup_consent() from public;

drop trigger if exists profiles_enforce_signup_consent on public.profiles;
create trigger profiles_enforce_signup_consent
  before insert on public.profiles
  for each row execute function public.enforce_signup_consent();

commit;
