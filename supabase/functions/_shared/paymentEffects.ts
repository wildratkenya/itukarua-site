// Server-authoritative payment fulfilment.
//
// Every effect a payment is supposed to have — renewing an advert, extending a
// subscription, publishing a banner — lives here, and runs on the server. It used
// to run in the browser's onComplete handler, so a customer who closed the tab
// after paying was charged and got nothing. Safaricom also retries callbacks, so
// fulfilment has to be idempotent: applyPaymentEffects claims the pending ->
// completed transition with a conditional update, and a second attempt finds
// nothing to claim and returns without acting.
//
// The status/label rendering lives client-side in src/lib/adLifecycle.ts; the
// rules these two share (plans, cycle labels, day counts) are duplicated here
// deliberately, because an edge function cannot import from src/.

import { loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from './smtp.ts'
import { renewCorporate } from './corporateBilling.ts'

export type PaymentRow = {
  id: string
  user_id: string | null
  payment_type: string
  amount: number | string | null
  mpesa_ref: string | null
  status: string
  description: string | null
  related_job_id: string | null
  related_ad_id: string | null
  related_profile_id: string | null
  related_account_id: string | null
  related_invoice_id: string | null
  checkout_request_id: string | null
  local_checkout_id: string | null
  metadata: Record<string, any> | null
  created_at?: string
  updated_at?: string
  access_expires_at?: string | null
}

// ─── Plan maths (mirrors src/lib/database.ts + DashboardPage price table) ───

export const SERVICE_PLANS = { '10-day': 10, '20-day': 20, '30-day': 30 } as const
export type ServicePlan = keyof typeof SERVICE_PLANS

export const SERVICE_PLAN_KES: Record<ServicePlan, number> = {
  '10-day': 300,
  '20-day': 500,
  '30-day': 800,
}

export function isServicePlan(v: unknown): v is ServicePlan {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SERVICE_PLANS, v)
}

export function planDays(plan: string | null | undefined): number {
  if (isServicePlan(plan)) return SERVICE_PLANS[plan]
  const n = parseInt(String(plan || '').replace(/[^0-9]/g, ''), 10)
  return n > 0 ? n : 30
}

export function cycleLabel(plan: string | null | undefined): string {
  if (isServicePlan(plan)) return `${SERVICE_PLANS[plan]} days`
  return `${planDays(plan)} days`
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime())
  out.setDate(out.getDate() + n)
  return out
}

export function addHours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60 * 60 * 1000)
}

/** Numeric platform_settings lookup with a sane fallback. */
export async function readSettingInt(supabase: any, key: string, fallback: number): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  const n = Number(data?.value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Work out which plan was bought.
 *
 * metadata.plan is authoritative and is what the client now sends. The amount
 * and then the advert's existing plan are fallbacks so payments initiated by an
 * older cached client bundle still fulfil sensibly rather than silently landing
 * on the wrong duration.
 */
export function resolveServicePlan(payment: PaymentRow, currentPlan?: string | null): ServicePlan {
  const meta = payment.metadata || {}
  if (isServicePlan(meta.plan)) return meta.plan
  if (typeof meta.days === 'number' && meta.days > 0) {
    if (meta.days <= 10) return '10-day'
    if (meta.days <= 20) return '20-day'
    return '30-day'
  }
  const amount = Number(payment.amount || 0)
  if (amount >= SERVICE_PLAN_KES['30-day']) return '30-day'
  if (amount >= SERVICE_PLAN_KES['20-day']) return '20-day'
  if (amount >= SERVICE_PLAN_KES['10-day']) return '10-day'
  if (isServicePlan(currentPlan)) return currentPlan
  return '10-day'
}

// ─── Self-serve adverts (service_ads) ───────────────────────────────────────

/**
 * Confirm payment and open (or extend) the billing window.
 *
 * Extends from the later of now and the current expiry, so a customer renewing
 * early never loses the days they already paid for. `featured` is only driven by
 * the plan when there is no live purchased boost, because Featured Boost is a
 * separate product with its own expiry and must not be cancelled by a plan
 * renewal.
 */
export async function fulfilServiceAd(supabase: any, payment: PaymentRow): Promise<void> {
  const adId = payment.related_ad_id
  if (!adId) return

  const { data: ad } = await supabase
    .from('service_ads')
    .select('*')
    .eq('id', adId)
    .maybeSingle()
  if (!ad) {
    console.error('[fulfilment] service_ads row missing for payment', payment.id, adId)
    return
  }

  const plan = resolveServicePlan(payment, ad.plan)
  const days = SERVICE_PLANS[plan]
  const now = new Date()
  const currentEnd = ad.billing_end ? new Date(ad.billing_end) : null
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now
  const end = addDays(base, days)
  const endDate = end.toISOString().slice(0, 10)
  const endIso = new Date(`${endDate}T00:00:00Z`).toISOString()

  const liveBoost = !!(ad.boost_until && new Date(ad.boost_until).getTime() > now.getTime())
  const featured = liveBoost ? true : plan === '30-day'

  const patch: Record<string, any> = {
    plan,
    payment_confirmed: true,
    expiry_date: endDate,
    billing_cycle: cycleLabel(plan),
    billing_start: now.toISOString(),
    billing_end: endIso,
  }
  if (!liveBoost) {
    patch.featured = featured
    patch.boost_until = featured ? endIso : null
  }
  // A fresh payment re-arms the expiry notice for the next cycle.
  patch.expired_notified_at = null

  const { error } = await supabase.from('service_ads').update(patch).eq('id', adId)
  if (error) throw new Error(`fulfilServiceAd ${adId}: ${error.message}`)

  console.log(
    `[fulfilment] service_ad ${adId} paid (${plan}, ${days}d) live until ${endDate}` +
      (liveBoost ? ' [existing boost preserved]' : ''),
  )
}

// ─── Admin banners (advertisements) ─────────────────────────────────────────

/** Publish a paid banner so it starts serving for its billing cycle. */
export async function fulfilBanner(supabase: any, payment: PaymentRow): Promise<void> {
  const adId = payment.related_ad_id
  if (!adId) return

  const { data: ad } = await supabase
    .from('advertisements')
    .select('id, billing_cycle, billing_end')
    .eq('id', adId)
    .maybeSingle()
  if (!ad) {
    console.error('[fulfilment] advertisements row missing for payment', payment.id, adId)
    return
  }

  const days = planDays(ad.billing_cycle)
  const now = new Date()
  const currentEnd = ad.billing_end ? new Date(ad.billing_end) : null
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now
  const end = addDays(base, days)

  const { error } = await supabase
    .from('advertisements')
    .update({
      active: true,
      payment_confirmed: true,
      billing_start: now.toISOString(),
      billing_end: end.toISOString(),
      expired_notified_at: null,
    })
    .eq('id', adId)
  if (error) throw new Error(`fulfilBanner ${adId}: ${error.message}`)

  console.log(`[fulfilment] banner ${adId} paid, live for ${days}d until ${end.toISOString()}`)
}

// ─── Job listings ───────────────────────────────────────────────────────────

/** Listing days bought by a job payment: an explicit token grants one day. */
function jobListingDays(payment: PaymentRow): number {
  if (payment.payment_type === 'employer_day_token') return 1
  const amount = Number(payment.amount || 0)
  if (amount >= 800) return 30
  if (amount >= 500) return 20
  if (amount >= 300) return 10
  return 1
}

/**
 * Publish/reactivate a single job ad. Only applies while the application
 * deadline has not passed — deadline-expired ads must be retired/re-posted.
 */
export async function fulfilJobListing(supabase: any, payment: PaymentRow): Promise<void> {
  if (!payment.related_job_id) return
  const { data: job } = await supabase
    .from('jobs')
    .select('deadline')
    .eq('id', payment.related_job_id)
    .maybeSingle()
  if (!job) return
  const today = new Date().toISOString().slice(0, 10)
  if (job.deadline && job.deadline < today) {
    console.error('[fulfilment] job listing paid but deadline already passed:', payment.related_job_id)
    return
  }
  const end = addDays(new Date(), jobListingDays(payment)).toISOString()
  const { error } = await supabase
    .from('jobs')
    .update({ valid_until: end, status: 'open', retired_at: null, retired_by: null })
    .eq('id', payment.related_job_id)
  if (error) throw new Error(`fulfilJobListing ${payment.related_job_id}: ${error.message}`)
  console.log(`[fulfilment] job ${payment.related_job_id} paid, valid until ${end}`)
}

/** Employer Weekly covers all of the employer's ads: re-enable every unexpired one. */
export async function reactivateEmployerJobs(supabase: any, userId: string | null): Promise<void> {
  if (!userId) return
  const today = new Date().toISOString().slice(0, 10)
  const end = addDays(new Date(), 7).toISOString()
  await supabase
    .from('jobs')
    .update({ valid_until: end, status: 'open', retired_at: null, retired_by: null })
    .eq('posted_by', userId)
    .eq('status', 'open')
    .gte('deadline', today)
    .or('retired_by.is.null,retired_by.eq.employer')
}

// ─── Subscriptions (profile_roles is the source of truth) ───────────────────

async function profileRole(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role || 'jobseeker'
}

/**
 * Extend a role entitlement.
 *
 * Writes profile_roles, which is what hasEntitlement() reads — until now only
 * the browser wrote it, so the table that actually gates paid features was
 * browser-dependent in exactly the same way adverts were.
 *
 * Never shortens an existing entitlement: a Day Token is one day in total, so if
 * a longer entitlement is already running the token adds nothing rather than
 * truncating paid days.
 */
export async function fulfilSubscription(supabase: any, payment: PaymentRow): Promise<void> {
  const userId = payment.user_id
  if (!userId) return

  const meta = payment.metadata || {}
  const role =
    typeof meta.role === 'string' && meta.role
      ? meta.role
      : payment.payment_type === 'employer_day_access' || payment.payment_type === 'employer_day_token'
        ? 'employer'
        : await profileRole(supabase, userId)

  // metadata.days is authoritative; the description checks are only for older
  // clients that do not send metadata yet.
  const days =
    typeof meta.days === 'number' && meta.days > 0
      ? meta.days
      : payment.payment_type === 'employer_day_access'
        ? 1
        : payment.description?.includes('Employer Weekly')
          ? 7
          : 30

  const now = new Date()
  const { data: existing } = await supabase
    .from('profile_roles')
    .select('paid, expires_at, token_days')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle()

  const currentEnd = existing?.expires_at ? new Date(existing.expires_at) : null
  const hasLiveAccess = !!(currentEnd && currentEnd.getTime() > now.getTime())
  const base = hasLiveAccess ? currentEnd! : now
  const target = addDays(base, days)
  // Never reduce an entitlement, even if the purchase is shorter than what is
  // already running.
  const finalEnd = hasLiveAccess && currentEnd!.getTime() >= target.getTime() ? currentEnd! : target

  const { error: roleErr } = await supabase
    .from('profile_roles')
    .upsert(
      {
        user_id: userId,
        role,
        paid: true,
        expires_at: finalEnd.toISOString(),
        token_days: Math.max(existing?.token_days ?? 0, days),
        updated_at: now.toISOString(),
        last_payment_id: payment.id,
        source: 'mpesa',
      },
      { onConflict: 'user_id,role' },
    )
  if (roleErr) throw new Error(`fulfilSubscription profile_roles: ${roleErr.message}`)

  // Legacy mirror: profiles.subscription_expires_at / registration_paid still
  // drive the login gate and the header notice, so keep them, but never
  // backwards — one timestamp has to stand in for every role the user holds.
  const { data: prof } = await supabase
    .from('profiles')
    .select('subscription_expires_at')
    .eq('id', userId)
    .maybeSingle()
  const profEnd = prof?.subscription_expires_at ? new Date(prof.subscription_expires_at) : null
  const keepProf = profEnd && profEnd.getTime() >= finalEnd.getTime() ? profEnd : finalEnd

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ subscription_expires_at: keepProf.toISOString(), registration_paid: true })
    .eq('id', userId)
  if (profErr) throw new Error(`fulfilSubscription profiles: ${profErr.message}`)

  // Employer Weekly also re-enables every eligible job advert.
  if (role === 'employer' && days === 7) {
    await reactivateEmployerJobs(supabase, userId)
  }

  console.log(
    `[fulfilment] subscription ${userId}/${role} +${days}d -> ${finalEnd.toISOString()}` +
      (finalEnd.getTime() === currentEnd?.getTime() ? ' (no-op, longer entitlement already running)' : ''),
  )
}

// ─── Featured boost ─────────────────────────────────────────────────────────

/** Canonical Featured Boost price, in KES. Admin and product copy must match. */
export const BOOST_PRICE_KES = 500
export const BOOST_MS = 7 * 24 * 60 * 60 * 1000

/** KES 500 adds exactly 7 days onto a live boost, otherwise starts a fresh window. */
export async function fulfilFeaturedBoost(supabase: any, payment: PaymentRow): Promise<void> {
  if (!payment.related_ad_id && !payment.related_job_id) return
  if (Number(payment.amount) !== BOOST_PRICE_KES) {
    throw new Error(
      `Featured boost underpays: expected KES ${BOOST_PRICE_KES}, received ${payment.amount}. Boost withheld for manual review.`,
    )
  }

  let table: string | null = null
  let serviceRow: any = null
  if (payment.related_job_id) {
    table = 'jobs'
  } else {
    const { data: srv } = await supabase.from('service_ads').select('*').eq('id', payment.related_ad_id).maybeSingle()
    if (srv) {
      table = 'service_ads'
      serviceRow = srv
    }
    const { data: ad } = await supabase.from('advertisements').select('id').eq('id', payment.related_ad_id).maybeSingle()
    if (ad) table = 'advertisements'
  }
  if (!table) return

  const id = payment.related_job_id || payment.related_ad_id
  const now = Date.now()
  const { data: row } = await supabase.from(table).select('boost_until').eq('id', id).maybeSingle()
  const live = row?.boost_until && new Date(row.boost_until).getTime() > now
  const base = live ? new Date(row!.boost_until).getTime() : now
  const boostEndIso = new Date(base + BOOST_MS).toISOString()

  const { error } = await supabase
    .from(table)
    .update({ featured: true, boost_until: boostEndIso })
    .eq('id', id)
  if (error) throw new Error(`fulfilFeaturedBoost ${table}/${id}: ${error.message}`)

  // Featured Boost spec: a boosted service listing also shows in the prime
  // homepage carousel. The carousel reads `advertisements` only, so mirror the
  // service ad into an `advertisements` row tied back via service_ad_id. The
  // row's billing window equals the boost window, so boost-expire's existing
  // window-expiry pass deactivates it when the boost lapses. owner_email/owner
  // stay null so the advert-expiry email pass ignores the mirror row (the
  // service row itself gets the renewal notices).
  if (table === 'service_ads' && serviceRow) {
    const nowIso = new Date(now).toISOString()
    const imageUrls = Array.isArray(serviceRow.images) ? serviceRow.images.filter(Boolean) : []
    const placement = {
      title: serviceRow.business_name || serviceRow.title || 'Service advert',
      description: serviceRow.description || null,
      cta_text: 'Learn More',
      image_url: imageUrls[0] || serviceRow.image || '',
      images: imageUrls,
      whatsapp_number: serviceRow.whatsapp_number || null,
      destination_url: serviceRow.destination_url || null,
      slot: 'homepage_banner',
      active: true,
      featured: true,
      boost_until: boostEndIso,
      billing_start: nowIso,
      billing_end: boostEndIso,
      payment_confirmed: true,
      is_affiliate: false,
      service_ad_id: id,
    }
    const { error: carrier } = await supabase
      .from('advertisements')
      .upsert(placement, { onConflict: 'service_ad_id' })
    if (carrier) {
      throw new Error(`fulfilFeaturedBoost carrier advertisements: ${carrier.message}`)
    }
    console.log(`[fulfilment] featured boost carousel mirror ${id} -> ${boostEndIso}`)
  }

  console.log(`[fulfilment] featured boost ${table}/${id} -> ${boostEndIso}`)
}

// ─── Corporate renewal ──────────────────────────────────────────────────────

/** Validates against the latest issued invoice, then renews the whole account. */
export async function fulfilCorporate(supabase: any, payment: PaymentRow): Promise<void> {
  if (!payment.related_account_id) return
  const { data: inv } = await supabase
    .from('corporate_invoices')
    .select('id, amount, status')
    .eq('account_id', payment.related_account_id)
    .in('status', ['issued', 'overdue'])
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (inv && Number(payment.amount) < Number(inv.amount)) {
    throw new Error(
      `Corporate renewal underpays: invoice ${inv.amount}, received ${payment.amount}. Renewal withheld for manual review.`,
    )
  }

  await renewCorporate(supabase, payment.related_account_id, {
    invoiceId: payment.related_invoice_id || inv?.id || null,
    mpesaRef: payment.mpesa_ref || null,
  })
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

/**
 * Run the effects for a payment. No status claim here — see applyPaymentEffects.
 * Throws so the caller can leave effects_applied_at NULL and let the daily
 * reconcile retry.
 */
export async function runPaymentEffects(supabase: any, payment: PaymentRow): Promise<string[]> {
  const done: string[] = []
  const meta = payment.metadata || {}

  switch (payment.payment_type) {
    case 'registration':
    case 'employer_day_access':
      await fulfilSubscription(supabase, payment)
      done.push('subscription')
      break

    case 'job_listing':
    case 'employer_day_token':
      await fulfilJobListing(supabase, payment)
      done.push('job_listing')
      break

    case 'advert': {
      const { data: srv } = await supabase
        .from('service_ads')
        .select('id')
        .eq('id', payment.related_ad_id || '')
        .maybeSingle()
      if (srv) {
        await fulfilServiceAd(supabase, payment)
        done.push('service_ad')
      } else {
        await fulfilBanner(supabase, payment)
        done.push('banner')
      }
      break
    }

    case 'featured_boost':
      await fulfilFeaturedBoost(supabase, payment)
      done.push('featured_boost')
      break

    case 'corporate':
      await fulfilCorporate(supabase, payment)
      done.push('corporate')
      break

    case 'advert_upgrade': {
      // Slot upgrades are recorded and applied, leaving the billing window alone.
      const slot = meta.slot
      if (payment.related_ad_id && typeof slot === 'string' && slot) {
        await supabase.from('advertisements').update({ slot }).eq('id', payment.related_ad_id)
        done.push(`advert_upgrade:${slot}`)
      }
      break
    }

    case 'contact_access': {
      // One-Day Contact Access: a per-profile window on the payment row. The
      // window starts when the payment completes; renewing while one is live
      // simply opens a fresh (later) window, and redemption takes the maximum.
      const hours = await readSettingInt(supabase, 'contact_access_window_hours', 24)
      const end = addHours(new Date(), hours).toISOString()
      const { error } = await supabase
        .from('payments')
        .update({ access_expires_at: end })
        .eq('id', payment.id)
      if (error) throw new Error(`fulfilContactAccess ${payment.id}: ${error.message}`)
      done.push(`contact_access:${hours}h`)
      console.log(`[fulfilment] contact_access ${payment.id} unlocks ${payment.related_profile_id || '?'} until ${end}`)
      break
    }

    default:
      // job_posting, job_payment, single_job_post: the payment
      // itself is the entitlement, nothing further to write.
      done.push('recorded_only')
      break
  }

  return done
}

export type ApplyResult = { claimed: boolean; payment: PaymentRow; effects: string[] | null; error?: string }

/**
 * Claim the pending/failed -> completed transition and apply the effects.
 *
 * The conditional update is the idempotency token: Safaricom retries callbacks,
 * and the browser polls /status, so this can be entered several times for one
 * payment. Only the first attempt updates a row and proceeds; the rest see zero
 * rows and return untouched.
 */
export async function applyPaymentEffects(
  supabase: any,
  payment: PaymentRow,
  opts: { mpesaRef?: string | null; force?: boolean } = {},
): Promise<ApplyResult> {
  const nowIso = new Date().toISOString()
  const mpesaRef =
    opts.mpesaRef || payment.mpesa_ref || `MPE${Date.now().toString().slice(-8)}`

  let claimed: PaymentRow | null = payment
  if (!opts.force) {
    const { data, error } = await supabase
      .from('payments')
      .update({ status: 'completed', mpesa_ref: mpesaRef })
      .eq('id', payment.id)
      .neq('status', 'completed')
      .select('*')
      .maybeSingle()
    if (error) throw new Error(`applyPaymentEffects claim: ${error.message}`)
    if (!data) {
      // Already completed by an earlier attempt — somebody else's problem now.
      const { data: current } = await supabase.from('payments').select('*').eq('id', payment.id).maybeSingle()
      return { claimed: false, payment: current || payment, effects: null }
    }
    claimed = data as PaymentRow
  }

  try {
    const effects = await runPaymentEffects(supabase, claimed)
    const { error: markErr } = await supabase
      .from('payments')
      .update({ effects_applied_at: nowIso })
      .eq('id', claimed.id)
    if (markErr) throw new Error(`applyPaymentEffects mark: ${markErr.message}`)
    return { claimed: true, payment: claimed, effects }
  } catch (err: any) {
    // Deliberately leave effects_applied_at NULL so payments-reconcile retries.
    console.error(`[fulfilment] payment ${claimed.id} (${claimed.payment_type}) failed:`, err?.message)
    return { claimed: true, payment: claimed, effects: null, error: err?.message || String(err) }
  }
}

// ─── Reconcile ──────────────────────────────────────────────────────────────

export type ReconcileRow = { id: string; payment_type: string; amount: number | null; ok: boolean; effects?: string[]; error?: string }

/**
 * Re-apply effects for completed payments that never got them (lost callback,
 * function crash mid-dispatch, browser-only fulfilment in the old flow).
 * Forces past the idempotency claim, which is safe because effects_applied_at
 * being NULL is the definition of "not applied".
 */
export async function reconcileUnappliedPayments(supabase: any, limit = 200): Promise<ReconcileRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('status', 'completed')
    .is('effects_applied_at', null)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`reconcile query: ${error.message}`)

  const rows: ReconcileRow[] = []
  for (const payment of (data || []) as PaymentRow[]) {
    try {
      const effects = await runPaymentEffects(supabase, payment)
      await supabase
        .from('payments')
        .update({ effects_applied_at: new Date().toISOString() })
        .eq('id', payment.id)
      rows.push({ id: payment.id, payment_type: payment.payment_type, amount: Number(payment.amount || 0), ok: true, effects })
      console.log(`[reconcile] repaired payment ${payment.id} (${payment.payment_type}) -> ${effects.join(',')}`)
    } catch (err: any) {
      rows.push({
        id: payment.id,
        payment_type: payment.payment_type,
        amount: Number(payment.amount || 0),
        ok: false,
        error: err?.message || String(err),
      })
      console.error(`[reconcile] payment ${payment.id} still failing:`, err?.message)
    }
  }
  return rows
}

// ─── Receipts ───────────────────────────────────────────────────────────────

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  registration: 'Account Registration',
  contact_access: 'Contact Access',
  job_posting: 'Job Posting',
  job_payment: 'Job Payment',
  advert: 'Advertisement',
  advert_upgrade: 'Advertisement Upgrade',
  featured_boost: 'Featured Boost',
  single_job_post: 'Single Job Access',
  employer_day_token: 'Employer Day Token',
  employer_day_access: 'Employer Day Access',
  job_listing: 'Job Listing',
  corporate: 'Corporate Subscription Renewal',
}

export function paymentLabel(paymentType: string): string {
  return PAYMENT_TYPE_LABELS[paymentType] || 'Payment'
}

export async function sendPaymentReceipt(supabase: any, payment: PaymentRow, mpesaRef?: string | null): Promise<void> {
  try {
    if (!payment?.user_id) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', payment.user_id)
      .maybeSingle()
    const recipient = profile?.email
    if (!recipient) return

    const label = paymentLabel(payment.payment_type)
    const amount = Number(payment.amount || 0).toLocaleString()
    const ref = mpesaRef || payment.mpesa_ref || 'Pending'
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff">
  <tr><td style="background:linear-gradient(135deg,#059669,#047857);padding:24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">Payment Received ✅</h1>
    <p style="color:#d1fae5;font-size:13px;margin:6px 0 0">${dateStr}</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 4px;color:#374151;font-size:14px">Hello ${escapeHtml(profile?.full_name || 'there')},</p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px">Thank you! Your payment for <strong>${escapeHtml(label)}</strong> has been received successfully.</p>
    <table style="width:100%;border:1px solid #e5e7eb;border-radius:10px;border-collapse:collapse">
      <tr><td style="padding:12px;background:#f9fafb;font-weight:600;width:45%">Amount Paid</td><td style="padding:12px">KES ${amount}</td></tr>
      <tr><td style="padding:12px;background:#f9fafb;font-weight:600">Payment Type</td><td style="padding:12px">${escapeHtml(label)}</td></tr>
      <tr><td style="padding:12px;background:#f9fafb;font-weight:600">M-Pesa Reference</td><td style="padding:12px">${escapeHtml(ref)}</td></tr>
      <tr><td style="padding:12px;background:#f9fafb;font-weight:600">Account Reference</td><td style="padding:12px">${escapeHtml(payment.description || payment.checkout_request_id || 'ITUKARUA')}</td></tr>
    </table>
    <a href="${SITE_URL}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Continue on Itukarua →</a>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#9ca3af;font-size:11px;margin:0">This is a receipt for a payment made on <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua Classifieds</a>.</p>
  </td></tr>
</table>
</body>
</html>`

    const smtp = await loadSmtpConfig(supabase)
    const transport = createFreshTransport(smtp)
    await transport.sendMail({
      from: smtp.from,
      to: recipient,
      subject: `Itukarua — Payment Received: ${label}`,
      text: `Hello, thank you! Your payment for ${label} (KES ${amount}, Ref ${ref}) has been received.`,
      html,
    })
  } catch (err: any) {
    console.error('[fulfilment] Receipt email failed:', err?.message)
  }
}
