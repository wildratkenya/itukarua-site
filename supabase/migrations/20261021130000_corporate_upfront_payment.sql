-- Corporate upfront payment: account payment state, invoice due dates, and the
-- row guards that stop a member (or a browser) from granting a paid placement
-- to themselves.
--
-- The corporate flow now charges upfront: an account is created on email
-- verification with payment_status = 'unpaid', an invoice is issued for the
-- first period, and the placement only starts serving once that invoice is
-- paid. The money state therefore has to live in the database, and every write
-- to it has to come from the server.

-- ─── 1. Payment state on the corporate account ─────────────────────────────

alter table public.corporate_accounts
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists verified_at timestamptz,
  add column if not exists paid_at timestamptz;

alter table public.corporate_accounts
  drop constraint if exists corporate_accounts_payment_status_check;
alter table public.corporate_accounts
  add constraint corporate_accounts_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'overdue'));

-- ─── 2. Invoice due date and issue timestamp ───────────────────────────────

alter table public.corporate_invoices
  add column if not exists due_date date,
  add column if not exists issued_at timestamptz;

-- Backfill: an account that already runs a confirmed placement is treated as
-- paid so live placements keep serving through the rollout.
update public.corporate_accounts a
   set payment_status = 'paid',
       paid_at = coalesce(a.paid_at, now())
 where exists (
   select 1
     from public.advertisements ad
    where ad.corporate_account_id = a.id
      and ad.payment_confirmed = true
 );

update public.corporate_accounts
   set verified_at = coalesce(verified_at, created_at);

update public.corporate_invoices
   set due_date = coalesce(due_date, period_end),
       issued_at = coalesce(issued_at, created_at);

-- ─── 3. Who may write privileged fields ────────────────────────────────────
--
-- auth.role() reads the role claim of the JWT that made the request, so it
-- stays correct inside a SECURITY DEFINER function: a service-role call is
-- 'service_role' whatever the definer is, and a browser call is 'authenticated'
-- with the caller's own uid. current_user cannot be used here because a
-- SECURITY DEFINER function always runs as its owner.

create or replace function public.current_actor_is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.role(), '') = 'service_role'
    or exists (
      select 1 from public.user_roles ur
       where ur.id = auth.uid()
         and ur.role in ('admin', 'super_admin')
    )
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.role in ('admin', 'super_admin')
    );
$$;

revoke all on function public.current_actor_is_privileged() from public;
grant execute on function public.current_actor_is_privileged() to anon, authenticated, service_role;

-- ─── 4. profiles: administrative roles are not self-assignable ─────────────
--
-- The profile policies let a user insert and update their own row, and
-- create_user_profile() is SECURITY DEFINER with EXECUTE granted to anon and
-- authenticated, so a caller could hand themselves the super_admin role. The
-- guard is a trigger because row policies cannot compare the old and new
-- value of a column.

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_actor_is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role in ('admin', 'super_admin') then
      raise exception 'Only an administrator can assign the % role', new.role
        using errcode = '42501';
    end if;
  elsif new.role is distinct from old.role
        and new.role in ('admin', 'super_admin') then
    raise exception 'Only an administrator can assign the % role', new.role
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ─── 5. corporate_accounts: billing settings are server-owned ──────────────
--
-- Owners may edit their company details. The tier, the price, the activation
-- flag and the payment state stay with the server.

create or replace function public.guard_corporate_account_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_actor_is_privileged() then
    return new;
  end if;

  if new.tier is distinct from old.tier
     or new.monthly_price is distinct from old.monthly_price
     or new.custom_amount is distinct from old.custom_amount
     or new.features is distinct from old.features
     or new.is_active is distinct from old.is_active
     or new.payment_status is distinct from old.payment_status
     or new.paid_at is distinct from old.paid_at
     or new.verified_at is distinct from old.verified_at
     or new.next_billing_date is distinct from old.next_billing_date
     or new.billing_period is distinct from old.billing_period
     or new.last_invoice_at is distinct from old.last_invoice_at
     or new.last_report_at is distinct from old.last_report_at then
    raise exception 'Only an administrator can change corporate billing settings'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists corporate_accounts_guard_fields on public.corporate_accounts;
create trigger corporate_accounts_guard_fields
  before update on public.corporate_accounts
  for each row execute function public.guard_corporate_account_fields();

-- ─── 6. advertisements: a member cannot mark a placement as paid ──────────
--
-- corporate_validate_placement() re-derives the slot from the account tier,
-- but payment_confirmed, the tier and the billing window were still writable
-- by any member of the account, which is how an unpaid placement could be
-- switched on by hand. This trigger runs first (it sorts before
-- corporate_placement_bundle_check) so the placement validator still fills in
-- the billing window afterwards.

create or replace function public.guard_corporate_ad_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.corporate_accounts%rowtype;
begin
  if new.corporate_account_id is null then
    return new;
  end if;

  if public.current_actor_is_privileged() then
    return new;
  end if;

  select * into v_account
    from public.corporate_accounts
   where id = new.corporate_account_id;
  if not found then
    raise exception 'Corporate account % not found', new.corporate_account_id
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if v_account.payment_status <> 'paid' then
      raise exception 'Payment required: pay your corporate invoice before creating placements'
        using errcode = '42501';
    end if;
    new.payment_confirmed := true;
    new.corporate_tier := v_account.tier;
    -- The billing window belongs to the server: the placement validator fills
    -- it in from the account's paid period.
    new.billing_start := null;
    new.billing_end := null;
  else
    new.payment_confirmed := old.payment_confirmed;
    new.corporate_tier := old.corporate_tier;
    new.billing_start := old.billing_start;
    new.billing_end := old.billing_end;
  end if;

  return new;
end;
$$;

drop trigger if exists corporate_ad_guard_fields on public.advertisements;
create trigger corporate_ad_guard_fields
  before insert or update on public.advertisements
  for each row execute function public.guard_corporate_ad_fields();

-- ─── 7. payments: only the server creates payment rows ─────────────────────
--
-- auth_insert_payments allowed any signed-in browser to insert a payment with
-- status = 'completed', which the reconcile job would then fulfil. No client
-- code inserts payments (they are created by the M-Pesa edge function), so
-- the policy is dropped rather than narrowed.

drop policy if exists auth_insert_payments on public.payments;

-- ─── 8. Unpaid corporate placements are not public ─────────────────────────

drop policy if exists "Anyone can view active ads" on public.advertisements;
create policy "Anyone can view active ads"
  on public.advertisements
  for select
  to public
  using (active = true and (corporate_account_id is null or payment_confirmed = true));
