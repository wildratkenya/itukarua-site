-- Corporate monthly billing + alerts.
-- Adds billing fields to corporate_accounts, a corporate invoice ledger, and
-- server-side gating so placements honour their tier bundle (slot membership,
-- placement caps, featured promotion, image cap) and the team seat cap.

-- ─── 1. Billing fields on corporate_accounts ───────────────────────────────
alter table public.corporate_accounts
  add column if not exists monthly_price numeric,
  add column if not exists billing_period text not null default 'monthly',
  add column if not exists next_billing_date date,
  add column if not exists custom_amount numeric,
  add column if not exists last_invoice_at timestamptz,
  add column if not exists last_report_at timestamptz;

comment on column public.corporate_accounts.monthly_price is
  'Explicit monthly price for the account (set at creation). NULL = derive from tier.';
comment on column public.corporate_accounts.custom_amount is
  'Admin override that supersedes monthly_price / tier anchor when billing.';

-- ─── 2. Corporate invoice ledger ───────────────────────────────────────────
create table if not exists public.corporate_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.corporate_accounts(id) on delete cascade,
  invoice_no text not null,
  period_start date not null,
  period_end date not null,
  amount numeric not null,
  currency text not null default 'KES',
  status text not null default 'issued' check (status in ('issued','paid','overdue','void')),
  purpose text not null default 'monthly' check (purpose in ('monthly','topup','other')),
  sent_to text,
  sent_at timestamptz,
  paid_at timestamptz,
  mpesa_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_invoices_account_period_key unique (account_id, period_start)
);

comment on table public.corporate_invoices is
  'Monthly invoices per corporate account. One invoice per account per period (period_start).';

create or replace function public.update_corporate_invoices_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;
alter function public.update_corporate_invoices_updated_at() owner to postgres;

drop trigger if exists corporate_invoices_updated_at on public.corporate_invoices;
create trigger corporate_invoices_updated_at
  before update on public.corporate_invoices
  for each row execute function public.update_corporate_invoices_updated_at();

create index if not exists idx_corporate_invoices_account on public.corporate_invoices (account_id, status);
create index if not exists idx_corporate_invoices_due on public.corporate_invoices (status, period_end);

-- RLS: corporate members view their own account invoices; super_admin manages.
alter table public.corporate_invoices enable row level security;

drop policy if exists "corporate members read invoices" on public.corporate_invoices;
create policy "corporate members read invoices"
  on public.corporate_invoices for select
  using (public.is_corporate_member(account_id));

drop policy if exists "super_admin manages invoices" on public.corporate_invoices;
create policy "super_admin manages invoices"
  on public.corporate_invoices for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'));

grant select, insert, update, delete on public.corporate_invoices to authenticated;
grant all on public.corporate_invoices to service_role;

-- ─── 3. Payments: support corporate renewals ───────────────────────────────
alter table public.payments
  add column if not exists related_account_id uuid,
  add column if not exists related_invoice_id uuid;

comment on column public.payments.related_account_id is 'corporate account being renewed (payment_type = corporate)';
comment on column public.payments.related_invoice_id is 'corporate_invoices.id matched by a corporate renewal payment';

create index if not exists idx_payments_corporate on public.payments (user_id, payment_type, status)
  where payment_type = 'corporate';

-- ─── 4. Server-side gating ─────────────────────────────────────────────────
-- Mirrors the client effectiveFeaturesFor() model from src/data/siteData.ts
-- so a bundle can never be exceeded through the REST API.
create or replace function public.corporate_validate_placement()
returns trigger language plpgsql as $$
declare
  v_acc public.corporate_accounts%rowtype;
  v_slots text[];
  v_max int;
  v_seats int;
  v_has_featured boolean;
  v_has_multi boolean;
  v_live int;
  v_id_list jsonb;
begin
  if NEW.corporate_account_id is null then
    return NEW;
  end if;

  select * into v_acc from public.corporate_accounts where id = NEW.corporate_account_id;
  if not found then
    raise exception 'Corporate account % not found', NEW.corporate_account_id;
  end if;

  if v_acc.tier = 'custom' and v_acc.features is not null then
    v_id_list := coalesce(v_acc.features->'ids', '[]'::jsonb);
    select coalesce(
             array_agg(trim(leading 'slot_' from x)) filter (where x like 'slot_%'),
             '{}'::text[]
           )
      into v_slots
      from jsonb_array_elements_text(v_id_list) as t(x);
    v_max := greatest(1, coalesce((v_acc.features->>'placements')::int, 1));
    v_seats := greatest(1, coalesce((v_acc.features->>'team_seats')::int, 1));
    v_has_featured := v_id_list @> '["featured"]';
    v_has_multi := v_id_list @> '["multi_images"]';
  elsif v_acc.tier = 'bronze' then
    v_slots := array['sitewide_strip']; v_max := 1; v_seats := 1; v_has_featured := false; v_has_multi := false;
  elsif v_acc.tier = 'silver' then
    v_slots := array['sitewide_strip','category_strip']; v_max := 2; v_seats := 2; v_has_featured := false; v_has_multi := false;
  elsif v_acc.tier = 'gold' then
    v_slots := array['sitewide_strip','category_strip','homepage_banner']; v_max := 4; v_seats := 5; v_has_featured := true; v_has_multi := true;
  else
    v_slots := array['sitewide_strip','category_strip','homepage_banner','job_listings_top']; v_max := 99; v_seats := 20; v_has_featured := true; v_has_multi := true;
  end if;

  if NEW.slot is not null and not (NEW.slot = any(v_slots)) then
    raise exception 'Slot "%" is not included in the % corporate bundle', NEW.slot, v_acc.tier;
  end if;

  if NEW.featured and not v_has_featured then
    raise exception 'Featured boost is not included in the % corporate bundle', v_acc.tier;
  end if;
  if v_has_featured then
    NEW.featured := true; -- gold/custom bundles promote every placement
  end if;

  if v_has_multi then
    if cardinality(NEW.images) > 5 then
      raise exception 'The % corporate bundle allows at most 5 images per creative', v_acc.tier;
    end if;
  elsif cardinality(NEW.images) > 1 then
    raise exception 'The % corporate bundle allows a single image per creative', v_acc.tier;
  end if;

  if TG_OP = 'INSERT' or NEW.id is distinct from OLD.id then
    select count(*) into v_live
      from public.advertisements
     where corporate_account_id = NEW.corporate_account_id
       and coalesce(active, true);
    if v_live >= v_max then
      raise exception '% has reached its limit of % concurrent placement(s)', v_acc.company_name, v_max;
    end if;
  end if;

  -- A live placement must sit inside a billing window. Default to the account
  -- period so a placement can never serve outside a paid month.
  if NEW.billing_start is null then
    NEW.billing_start := now();
  end if;
  if NEW.billing_end is null then
    NEW.billing_end := coalesce(v_acc.next_billing_date, now() + interval '30 days');
  end if;

  return NEW;
end;
$$;
alter function public.corporate_validate_placement() owner to postgres;

drop trigger if exists corporate_placement_bundle_check on public.advertisements;
create trigger corporate_placement_bundle_check
  before insert or update on public.advertisements
  for each row execute function public.corporate_validate_placement();

-- Seat cap on corporate_members (belt-and-braces behind the edge-fn check).
create or replace function public.corporate_validate_member_seats()
returns trigger language plpgsql as $$
declare
  v_acc public.corporate_accounts%rowtype;
  v_seats int;
  v_count int;
begin
  select * into v_acc from public.corporate_accounts where id = NEW.account_id;
  if not found then
    raise exception 'Corporate account not found';
  end if;

  if v_acc.tier = 'custom' and v_acc.features is not null then
    v_seats := greatest(1, coalesce((v_acc.features->>'team_seats')::int, 1));
  else
    v_seats := case v_acc.tier when 'gold' then 5 when 'silver' then 2 when 'custom' then 20 else 1 end;
  end if;

  if TG_OP = 'UPDATE' and OLD.account_id = NEW.account_id and OLD.profile_id = NEW.profile_id then
    return NEW; -- role-only change
  end if;

  select count(*) into v_count
    from public.corporate_members
   where account_id = NEW.account_id;

  if v_count >= v_seats then
    raise exception 'The team seat limit for % has been reached (% seats)', v_acc.company_name, v_seats;
  end if;
  return NEW;
end;
$$;
alter function public.corporate_validate_member_seats() owner to postgres;

drop trigger if exists corporate_members_seat_check on public.corporate_members;
create trigger corporate_members_seat_check
  before insert on public.corporate_members
  for each row execute function public.corporate_validate_member_seats();

-- ─── 5. Renewal helper for edge functions ──────────────────────────────────
create or replace function public.extend_corporate_ads(p_account_id uuid, p_days int)
returns void language plpgsql as $$
begin
  update public.advertisements
     set billing_end = greatest(coalesce(billing_end, now()), now()) + (p_days * interval '1 day')
   where corporate_account_id = p_account_id;
end;
$$;
alter function public.extend_corporate_ads(uuid, int) owner to postgres;
grant execute on function public.extend_corporate_ads(uuid, int) to service_role, authenticated;