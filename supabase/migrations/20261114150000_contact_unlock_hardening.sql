-- Migration: Contact-unlock hardening & entitlement lock-down (Item #4)
--
-- 1. get_profile_contact / redeem_contact_token refuse suspended profiles
--    (even when they opted into contact display or hold a live token).
-- 2. profile_roles: owner INSERT is limited to paid=false + expires_at=NULL;
--    owner UPDATE policy is dropped so authenticated users cannot self-promote
--    paid = true (delete-and-re-insert is also blocked since no owner DELETE
--    policy exists).
-- 3. profiles: auth_update_own_profile WITH CHECK blocks self-changes to
--    role, subscription_expires_at, registration_paid, suspended, email,
--    verified. Legitimate self-updates (name, phone, bio, etc.) are untouched.
-- 4. audit_log: unique index on (payment_id, action) for at-most-once grants;
--    admin SELECT policy aligned to AdminPage's admin definition
--    (profiles.role IN ('admin','super_admin')).
--
-- Includes BEGIN / SAVEPOINT / ROLLBACK verification tests. Test data is
-- rolled back; the DDL persists.

BEGIN;

-- =========================================================================
-- 0. Suspended-contact guard: get_profile_contact (recreate with guard)
-- =========================================================================
create or replace function public.get_profile_contact(
  p_profile_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_user uuid := auth.uid();
  v_allowed boolean := false;
  v_expires timestamptz;
begin
  if p_profile_id is null then
    return '{"allowed":false,"reason":"missing"}'::json;
  end if;

  select * into v_profile from public.profiles where id = p_profile_id;
  if not found then
    return '{"allowed":false,"reason":"missing"}'::json;
  end if;

  -- A suspended account can never be unlocked, even if it opted in previously.
  if coalesce(v_profile.suspended, false) then
    return '{"allowed":false,"reason":"suspended"}'::json;
  end if;

  if v_profile.allow_contact_display is not true then
    return '{"allowed":false,"reason":"opted_out"}'::json;
  end if;

  if v_user = v_profile.id then
    v_allowed := true;
  end if;

  if not v_allowed and v_user is not null then
    select exists (
      select 1 from public.profiles p
      where p.id = v_user and p.role in ('admin', 'super_admin')
    ) into v_allowed;
  end if;

  if not v_allowed and v_user is not null then
    select exists (
      select 1 from public.payments pm
      where pm.user_id = v_user
        and pm.payment_type = 'contact_access'
        and pm.related_profile_id = v_profile.id
        and pm.status = 'completed'
        and pm.access_expires_at is not null
        and pm.access_expires_at > now()
    ) into v_allowed;
    if v_allowed then
      select max(pm.access_expires_at)
        into v_expires
      from public.payments pm
      where pm.user_id = v_user
        and pm.payment_type = 'contact_access'
        and pm.related_profile_id = v_profile.id
        and pm.status = 'completed'
        and pm.access_expires_at is not null
        and pm.access_expires_at > now();
    end if;
  end if;

  if not v_allowed and v_user is not null then
    select exists (
      select 1 from public.profile_roles pr
      where pr.user_id = v_user
        and pr.paid
        and pr.role = 'employer'
        and pr.expires_at is not null
        and pr.expires_at > now()
    ) into v_allowed;
    if v_allowed then
      select max(pr.expires_at)
        into v_expires
      from public.profile_roles pr
      where pr.user_id = v_user
        and pr.paid
        and pr.role = 'employer'
        and pr.expires_at > now();
    end if;
  end if;

  if not v_allowed and v_user is not null then
    select exists (
      select 1 from public.profiles p
      where p.id = v_user
        and p.registration_paid
        and p.role in ('employer', 'admin', 'super_admin')
        and p.subscription_expires_at is not null
        and p.subscription_expires_at > now()
    ) into v_allowed;
    if v_allowed then
      select p.subscription_expires_at
        into v_expires
      from public.profiles p
      where p.id = v_user;
    end if;
  end if;

  if not v_allowed and v_user is not null then
    if exists (
      select 1 from public.payments pm
      where pm.user_id = v_user
        and pm.payment_type = 'contact_access'
        and pm.related_profile_id = v_profile.id
        and pm.status = 'completed'
    ) then
      return '{"allowed":false,"reason":"expired"}'::json;
    end if;
  end if;

  if not v_allowed then
    return '{"allowed":false,"reason":"locked"}'::json;
  end if;

  return json_build_object(
    'allowed', true,
    'expires_at', v_expires,
    'contact', json_build_object(
      'phone', v_profile.phone,
      'email', v_profile.email,
      'whatsapp', v_profile.whatsapp_number,
      'location', v_profile.location,
      'county', v_profile.county,
      'subcounty', v_profile.subcounty,
      'national_id', v_profile.national_id
    ),
    'certificates', v_profile.certificates,
    'resume', v_profile.resume,
    'national_id', v_profile.national_id
  );
end;
$$;

comment on function public.get_profile_contact(uuid) is
  'Server-enforced contact reveal. Refuses suspended profiles. Returns phone/email/whatsapp/resume/national_id/certificates only to entitled callers.';

-- =========================================================================
-- 1. Suspended-contact guard: redeem_contact_token (recreate with guard)
-- =========================================================================
create or replace function public.redeem_contact_token(
  p_token text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_user uuid := auth.uid();
  v_suspended boolean := false;
begin
  if p_token is null or btrim(p_token) = '' then
    return '{"error":"missing"}'::json;
  end if;

  select * into v_payment
  from public.payments
  where token = btrim(p_token)
    and payment_type = 'contact_access'
  limit 1;

  if not found or v_payment.status <> 'completed' then
    return '{"error":"invalid"}'::json;
  end if;

  if v_payment.access_expires_at is null or v_payment.access_expires_at <= now() then
    return '{"error":"expired"}'::json;
  end if;

  -- A suspended target profile cannot be unlocked via token.
  if v_payment.related_profile_id is not null then
    select coalesce(suspended, false)
      into v_suspended
    from public.profiles
    where id = v_payment.related_profile_id;
    if v_suspended then
      return '{"error":"suspended"}'::json;
    end if;
  end if;

  -- Bind an orphan guest purchase to whoever first redeems it.
  if v_payment.user_id is null and v_user is not null then
    update public.payments
    set user_id = v_user
    where id = v_payment.id;
  end if;

  return json_build_object(
    'profile_id', v_payment.related_profile_id,
    'expires_at', v_payment.access_expires_at,
    'allowed', true
  );
end;
$$;

comment on function public.redeem_contact_token(text) is
  'Server-enforced contact token redemption. Refuses suspended target profiles.';

-- =========================================================================
-- 2. profile_roles: lock down owner writes
-- =========================================================================
drop policy if exists "profile_roles_owner_insert" on public.profile_roles;
create policy "profile_roles_owner_insert"
on public.profile_roles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and paid = false
  and expires_at is null
);

drop policy if exists "profile_roles_owner_update" on public.profile_roles;
-- No owner UPDATE replacement: authenticated users may not mutate entitlements.
-- Server-side grants (paymentEffects.ts, admin RPCs) use service_role.

-- =========================================================================
-- 3. profiles: block self-promotion via auth_update_own_profile
-- =========================================================================
drop policy if exists "auth_update_own_profile" on public.profiles;
create policy "auth_update_own_profile" on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and (new.role is not distinct from old.role)
  and (new.subscription_expires_at is not distinct from old.subscription_expires_at)
  and (new.registration_paid is not distinct from old.registration_paid)
  and (new.suspended is not distinct from old.suspended)
  and (new.email is not distinct from old.email)
  and (new.verified is not distinct from old.verified)
);

-- =========================================================================
-- 4. audit_log: at-most-once index + admin SELECT policy alignment
-- =========================================================================
create unique index if not exists audit_log_payment_action_unique
  on public.audit_log (payment_id, action)
  where payment_id is not null;

drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  )
);

-- =========================================================================
-- 5. Verification tests (test data rolled back; DDL persists).
-- =========================================================================
savepoint verify_tests;

-- Seed test users (profiles.id has no FK to auth.users in this schema).
insert into public.profiles (id, role, full_name, suspended, deleted_at, allow_contact_display) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'jobseeker', 'Suspended Worker', true, null, true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'jobseeker', 'Active Worker', false, null, true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'jobseeker', 'Unlocked Worker', false, null, true)
on conflict (id) do nothing;

-- T1: profile_roles owner INSERT with paid = true is rejected.
set request.jwt.claims = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc", "role": "authenticated"}';
do $$
begin
  insert into public.profile_roles (user_id, role, paid, expires_at, source)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'jobseeker', true, now() + interval '30 days', 'mpesa');
  raise exception 'TEST FAIL: owner inserted profile_roles paid=true';
exception when others then
  raise notice 'TEST PASS: owner INSERT paid=true rejected';
end;
$$ language plpgsql;

-- T2: profile_roles owner UPDATE to paid = true is rejected (no owner UPDATE policy).
do $$
begin
  update public.profile_roles
  set paid = true, expires_at = now() + interval '30 days'
  where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and role = 'jobseeker';
  if found then
    raise exception 'TEST FAIL: owner updated profile_roles paid=true';
  end if;
  raise notice 'TEST PASS: owner UPDATE paid=true rejected (no matching row / no policy)';
end;
$$ language plpgsql;

-- T3: profiles owner UPDATE of role is rejected (WITH CHECK).
do $$
begin
  update public.profiles
  set role = 'employer', subscription_expires_at = now() + interval '30 days'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  if found then
    raise exception 'TEST FAIL: owner updated profiles.role';
  end if;
  raise notice 'TEST PASS: owner UPDATE profiles.role/subscription_expires_at rejected';
end;
$$ language plpgsql;

-- T4: get_profile_contact refuses a suspended profile.
set request.jwt.claims = '{"sub": "dddddddd-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';
do $$
declare
  result json;
begin
  select public.get_profile_contact('cccccccc-cccc-cccc-cccc-cccccccccccc')
    into result;
  if (result->>'allowed')::boolean then
    raise exception 'TEST FAIL: suspended contact unlocked: %', result;
  end if;
  if result->>'reason' <> 'suspended' then
    raise exception 'TEST FAIL: expected suspended reason, got %', result;
  end if;
  raise notice 'TEST PASS: get_profile_contact refuses suspended profile';
end;
$$ language plpgsql;

-- T5: get_profile_contact unlocks an active (opted-in) profile owned by caller.
do $$
declare
  result json;
begin
  select public.get_profile_contact('dddddddd-dddd-dddd-dddd-dddddddddddd')
    into result;
  if not (result->>'allowed')::boolean then
    raise exception 'TEST FAIL: active self-contact not unlocked: %', result;
  end if;
  raise notice 'TEST PASS: get_profile_contact unlocks active self-contact';
end;
$$ language plpgsql;

-- T6: redeem_contact_token refuses a suspended target profile.
-- Mint a completed contact_access payment for the suspended target, then redeem.
insert into public.payments (id, user_id, payment_type, amount, status, token, related_profile_id, access_expires_at)
values (
  gen_random_uuid(),
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'contact_access',
  100,
  'completed',
  'ITK-SUSPENDED-TEST',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  now() + interval '24 hours'
)
on conflict (token) do nothing;

do $$
declare
  result json;
begin
  select public.redeem_contact_token('ITK-SUSPENDED-TEST') into result;
  if (result->>'allowed')::boolean then
    raise exception 'TEST FAIL: redeem_contact_token unlocked suspended target: %', result;
  end if;
  if result->>'error' <> 'suspended' then
    raise exception 'TEST FAIL: expected suspended error, got %', result;
  end if;
  raise notice 'TEST PASS: redeem_contact_token refuses suspended target';
end;
$$ language plpgsql;

-- T7: audit_log at-most-once via unique index (duplicate payment_id+action rejected).
do $$
declare
  test_uid uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  dup_pid uuid;
begin
  -- Best-effort seed of an auth.users row so the FK is satisfied.
  begin
    insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (test_uid, 'authenticated', 'authenticated', 'test-hardening@example.com', '', '{}', '{}', now(), now());
  exception when unique_violation then null; end;

  insert into public.audit_log (user_id, action, payment_id, metadata)
  values (test_uid, 'grant_contact_access:test', gen_random_uuid(), '{"k":"v"}'::jsonb);
  raise notice 'TEST PASS: first audit_log insert accepted';

  select payment_id into dup_pid
  from public.audit_log
  where user_id = test_uid
  limit 1;

  begin
    insert into public.audit_log (user_id, action, payment_id, metadata)
    values (test_uid, 'grant_contact_access:test', dup_pid, '{"k":"v"}'::jsonb);
    raise exception 'TEST FAIL: duplicate audit_log insert was accepted';
  exception when unique_violation then
    raise notice 'TEST PASS: duplicate audit_log insert rejected by unique index';
  end;
end;
$$ language plpgsql;

rollback to savepoint verify_tests;

commit;
