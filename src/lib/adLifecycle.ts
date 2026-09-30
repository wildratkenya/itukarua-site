// One ad lifecycle, rendered the same way everywhere.
//
// The rule itself lives in the database (derive_ad_status / derive_banner_status,
// migration 20260925110000_ad_lifecycle_status.sql) so the client, /admin and the
// edge functions cannot disagree about whether an advert is live. This module is
// the presentation of that rule, shared by the owner dashboards and /admin:
//
//   unpaid     created, never paid      -> "Pay now"  (opens M-Pesa)
//   scheduled  paid, starts later       -> "Starts <date>"
//   active     paid and running         -> "Live until <date>"
//   expired    paid and ran out         -> "Expired" + "Renew"
//   paused     published then switched off by an admin -> "Paused"

import { supabase } from './supabase'

export type AdStatus = 'unpaid' | 'scheduled' | 'active' | 'expired' | 'paused'

export type AdStatusRow = {
  payment_confirmed?: boolean | null
  active?: boolean | null
  billing_start?: string | null
  billing_end?: string | null
  expiry_date?: string | null
}

/**
 * The authoritative status, from Postgres.
 *
 * Falls back to a local evaluation if the RPC is unavailable (a database that
 * has not had the migration applied yet), so the UI degrades to the old
 * behaviour instead of rendering nothing.
 */
export async function fetchAdStatus(
  row: AdStatusRow,
  kind: 'service' | 'banner' = 'service',
): Promise<AdStatus> {
  try {
    const { data, error } = await supabase.rpc(
      kind === 'banner' ? 'derive_banner_status' : 'derive_ad_status',
      kind === 'banner'
        ? {
            p_payment_confirmed: row.payment_confirmed ?? false,
            p_active: row.active ?? false,
            p_billing_start: row.billing_start ?? null,
            p_billing_end: row.billing_end ?? null,
          }
        : {
            p_payment_confirmed: row.payment_confirmed ?? false,
            p_billing_start: row.billing_start ?? null,
            p_billing_end: row.billing_end ?? null,
          },
    )
    if (!error && typeof data === 'string') return data as AdStatus
  } catch {
    // fall through to the local mirror
  }
  return localAdStatus(row, kind)
}

/** Mirror of the SQL functions, for optimistic UI and offline rendering. */
export function localAdStatus(row: AdStatusRow, kind: 'service' | 'banner' = 'service'): AdStatus {
  const now = Date.now()
  const end = row.billing_end ? new Date(row.billing_end).getTime() : null
  const start = row.billing_start ? new Date(row.billing_start).getTime() : null

  if (kind === 'banner') {
    if (!row.payment_confirmed) return 'unpaid'
    if (end != null && end <= now) return 'expired'
    if (!row.active) return 'paused'
    if (start != null && start > now) return 'scheduled'
    return 'active'
  }

  if (!row.payment_confirmed) return 'unpaid'
  if (start != null && start > now) return 'scheduled'
  if (end != null && end <= now) return 'expired'
  return 'active'
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  unpaid: 'Awaiting payment',
  scheduled: 'Scheduled',
  active: 'Live',
  expired: 'Expired',
  paused: 'Paused',
}

export const AD_STATUS_TONE: Record<AdStatus, string> = {
  unpaid: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  paused: 'bg-gray-200 text-gray-700',
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function daysUntil(value?: string | null): number {
  if (!value) return 0
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000))
}

/** The one line of copy shown under an advert's title. */
export function statusLine(row: AdStatusRow, status: AdStatus, kind: 'service' | 'banner' = 'service'): string {
  switch (status) {
    case 'unpaid':
      return kind === 'banner'
        ? 'Never published — pay to put it live'
        : 'Not live — complete payment to publish'
    case 'scheduled':
      return `Starts ${formatDate(row.billing_start)}`
    case 'active': {
      const days = daysUntil(row.billing_end)
      return days > 0 ? `Live until ${formatDate(row.billing_end)} · ${days}d left` : `Live until ${formatDate(row.billing_end)}`
    }
    case 'expired':
      return `Expired ${formatDate(row.billing_end || row.expiry_date)} — renew to go live again`
    case 'paused':
      return 'Paused by an admin — not serving'
  }
}

/** What the primary button should be for this status. */
export type AdAction = 'pay' | 'renew' | 'extend' | 'none'

export function primaryAction(status: AdStatus): AdAction {
  switch (status) {
    case 'unpaid':
      return 'pay'
    case 'expired':
      return 'renew'
    case 'active':
    case 'scheduled':
      // Renewal is allowed at any time; extending from the current expiry means
      // the customer never loses days they have already paid for.
      return 'extend'
    case 'paused':
      return 'none'
  }
}

export const AD_ACTION_LABEL: Record<AdAction, string> = {
  pay: 'Pay now',
  renew: 'Renew',
  extend: 'Extend',
  none: '',
}

// ─── Image caps ─────────────────────────────────────────────────────────────
// Plan caps: 10-day 3, 20-day 5, 30-day 8. A live Featured Boost raises the cap
// to at least 5 so a boosted 10-day advert can carry five photos.
export const SERVICE_IMAGE_CAPS: Record<string, number> = { '10-day': 3, '20-day': 5, '30-day': 8 }
export const BOOST_MIN_IMAGES = 5
export function serviceAdImageCap(planKey: string, boosted = false): number {
  const cap = SERVICE_IMAGE_CAPS[planKey] ?? 3
  return boosted ? Math.max(cap, BOOST_MIN_IMAGES) : cap
}
