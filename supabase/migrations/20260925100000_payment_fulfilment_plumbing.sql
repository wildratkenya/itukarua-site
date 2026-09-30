-- Payment fulfilment plumbing.
--
-- Fulfilment (renewing an advert, extending a subscription, publishing a banner)
-- used to happen only in the browser, so a closed tab meant the customer was
-- charged but nothing was applied. This migration adds the columns that let the
-- server apply effects on its own, exactly once, and let a daily cron repair
-- anything that slips through.
--
--   payments.metadata            structured purchase intent (kind, plan, days, role)
--   payments.effects_applied_at  marks that fulfilment ran; the idempotency claim
--   payments.local_checkout_id   our pre-Daraja id, so /status resolves either id
--   profile_roles.last_payment_id / source   audit trail for entitlement changes

alter table public.payments
  add column if not exists metadata jsonb,
  add column if not exists effects_applied_at timestamptz,
  add column if not exists local_checkout_id text;

comment on column public.payments.metadata is
  'Structured purchase intent: {kind, plan, days, role, local_checkout_id}. Replaces free-text description sniffing.';
comment on column public.payments.effects_applied_at is
  'Set when fulfilment applied. NULL on a completed payment = effects missing, repaired by payments-reconcile.';

-- The browser polls /status every 3s by checkout_request_id, and the Daraja
-- callback looks the same column up, so it needs an index.
create index if not exists payments_checkout_request_id_idx
  on public.payments (checkout_request_id)
  where checkout_request_id is not null;

create index if not exists payments_unapplied_idx
  on public.payments (created_at)
  where status = 'completed' and effects_applied_at is null;

-- Mark every already-completed payment as fulfilled. We cannot tell which of
-- these were applied by the old browser-driven flow and which were not, and
-- guessing wrong in the "not applied" direction would hand existing customers
-- duplicate paid days on the first reconcile run. The safe default is to treat
-- history as done; from this migration forward, effects_applied_at is only NULL
-- when fulfilment genuinely has not run.
update public.payments
set effects_applied_at = coalesce(updated_at, created_at, now())
where status = 'completed'
  and effects_applied_at is null;

-- Entitlement audit. profile_roles is the table hasEntitlement() reads, so it
-- must record which payment last changed it and where that change came from.
alter table public.profile_roles
  add column if not exists last_payment_id uuid references public.payments (id) on delete set null,
  add column if not exists source text;

-- Backfill: link any entitlement that was already paid for to the newest
-- completed payment for that user, so the first reconcile run can see it.
-- Note: this deliberately correlates at the top level rather than through a
-- LATERAL subquery. Postgres does not expose the UPDATE target alias to a
-- nested lateral FROM item, which fails with "missing FROM-clause entry".
update public.profile_roles pr
set last_payment_id = p.id,
    source = coalesce(pr.source, 'legacy')
from (
  select distinct on (user_id) user_id, id
  from public.payments
  where status = 'completed'
    and payment_type in ('registration', 'employer_day_access')
  order by user_id, created_at desc
) p
where p.user_id = pr.user_id
  and pr.last_payment_id is null;
