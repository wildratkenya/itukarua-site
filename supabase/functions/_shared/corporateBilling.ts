import { escapeHtml, SITE_URL } from './smtp.ts'

// ─── Tier pricing (mirrors src/data/siteData.ts anchors) ────────────────────

export const CORPORATE_TIER_ANCHOR_KES: Record<string, number> = {
  bronze: 3000,
  silver: 6000,
  gold: 10000,
}

export const FEATURE_MONTHLY_KES: Record<string, number> = {
  slot_sitewide_strip: 3000,
  slot_category_strip: 3000,
  slot_homepage_banner: 4000,
  slot_job_listings_top: 2000,
  featured: 2000,
  full_analytics: 1500,
  multi_images: 1000,
  placements: 1000,
  team_seats: 500,
}

export const TIER_FEATURE_IDS: Record<string, string[]> = {
  bronze: ['slot_sitewide_strip'],
  silver: ['slot_sitewide_strip', 'slot_category_strip'],
  gold: ['slot_sitewide_strip', 'slot_category_strip', 'slot_homepage_banner', 'featured', 'full_analytics', 'multi_images'],
  custom: [],
}

export const TIER_DEFAULTS: Record<string, { maxPlacements: number; teamSeats: number }> = {
  bronze: { maxPlacements: 1, teamSeats: 1 },
  silver: { maxPlacements: 2, teamSeats: 2 },
  gold: { maxPlacements: 4, teamSeats: 5 },
  custom: { maxPlacements: 99, teamSeats: 20 },
}

export const TIER_SLOTS: Record<string, string[]> = {
  bronze: ['sitewide_strip'],
  silver: ['sitewide_strip', 'category_strip'],
  gold: ['sitewide_strip', 'category_strip', 'homepage_banner'],
  custom: ['sitewide_strip', 'category_strip', 'homepage_banner', 'job_listings_top'],
}

export interface CorpFeaturesLike {
  ids?: string[]
  placements?: number
  team_seats?: number
}

export function effectivenessFor(account: { tier?: string; features?: CorpFeaturesLike | null }): {
  slots: string[]
  maxPlacements: number
  analyticsDepth: 'basic' | 'full'
  teamSeats: number
  featured: boolean
  multiImages: boolean
} {
  const tier = account?.tier || 'bronze'
  const saved = account?.features
  if (tier === 'custom' && saved && Array.isArray(saved.ids)) {
    const ids = saved.ids
    const has = (id: string) => ids.includes(id)
    const slots = (TIER_SLOTS.custom).filter((s) => has(`slot_${s}`))
    return {
      slots,
      maxPlacements: Math.max(1, saved.placements && saved.placements > 0 ? saved.placements : 1),
      analyticsDepth: has('full_analytics') ? 'full' : 'basic',
      teamSeats: Math.max(1, saved.team_seats && saved.team_seats > 0 ? saved.team_seats : 1),
      featured: has('featured'),
      multiImages: has('multi_images'),
    }
  }
  const d = TIER_DEFAULTS[tier] || TIER_DEFAULTS.bronze
  return {
    slots: TIER_SLOTS[tier] || TIER_SLOTS.bronze,
    maxPlacements: d.maxPlacements,
    analyticsDepth: tier === 'gold' || tier === 'custom' ? 'full' : 'basic',
    teamSeats: d.teamSeats,
    featured: tier === 'gold' || tier === 'custom',
    multiImages: tier === 'gold' || tier === 'custom',
  }
}

export function estimateCustomBundle(ids: string[], placements = 1, teamSeats = 1): { monthly: number; equivalence: string } {
  const has = (id: string) => ids.includes(id)
  const covers = (tier: string) => (TIER_FEATURE_IDS[tier] || []).every(has)
  let base: string | null = null
  if (covers('gold')) base = 'gold'
  else if (covers('silver')) base = 'silver'
  else if (covers('bronze')) base = 'bronze'
  const baseDef = base ? TIER_DEFAULTS[base] : null

  let monthly = base ? (CORPORATE_TIER_ANCHOR_KES[base] || 0) : 0
  const baseIds = base ? TIER_FEATURE_IDS[base] : []
  for (const id of ids) {
    if (baseIds.includes(id)) continue
    monthly += FEATURE_MONTHLY_KES[id] || 0
  }
  monthly += Math.max(0, placements - (baseDef ? baseDef.maxPlacements : 1)) * (FEATURE_MONTHLY_KES.placements || 1000)
  monthly += Math.max(0, teamSeats - (baseDef ? baseDef.teamSeats : 1)) * (FEATURE_MONTHLY_KES.team_seats || 500)
  return { monthly, equivalence: base ? (base.charAt(0).toUpperCase() + base.slice(1) + ' + add-ons') : 'Custom' }
}

const CUSTOM_TIER_ID = 'custom'

/** Effective monthly amount for an account: custom_amount > monthly_price > tier anchor > custom estimate. */
export function corporateMonthlyAmount(account: {
  tier?: string
  monthly_price?: number | null
  custom_amount?: number | null
  features?: CorpFeaturesLike | null
}): number {
  if (account?.custom_amount && Number(account.custom_amount) > 0) return Number(account.custom_amount)
  if (account?.monthly_price && Number(account.monthly_price) > 0) return Number(account.monthly_price)
  if (account?.tier && account.tier !== CUSTOM_TIER_ID && CORPORATE_TIER_ANCHOR_KES[account.tier]) {
    return CORPORATE_TIER_ANCHOR_KES[account.tier]
  }
  const saved = account?.features
  if (saved && Array.isArray(saved.ids)) {
    return estimateCustomBundle(saved.ids, saved.placements || 1, saved.team_seats || 1).monthly
  }
  return CORPORATE_TIER_ANCHOR_KES.bronze
}

// ─── Invoice rendering ───────────────────────────────────────────────────────

export interface CorporateInvoiceRenderOpts {
  account: {
    company_name: string
    tier?: string
  }
  invoiceNo: string
  periodStart: Date
  periodEnd: Date
  amount: number
  note: string
  reportHtml?: string
}

const TILL_NO = '1600149'

export function fmtKES(n: number): string {
  return `KES ${Number(n || 0).toLocaleString('en-KE')}`
}

function dueLabel(d: Date): string {
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function corporateInvoiceSubject(company: string): string {
  return `Itukarua — Corporate Placement Invoice (${company})`
}

export function buildCorporateInvoiceHtml(opts: CorporateInvoiceRenderOpts): string {
  const eCompany = escapeHtml(opts.account.company_name)
  const eTier = escapeHtml(String(opts.account.tier || '').toUpperCase())
  const eNote = escapeHtml(opts.note)
  const amt = fmtKES(opts.amount)
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb">
  <tr><td style="background:linear-gradient(135deg,#111827,#1f2937);padding:26px;text-align:center">
    <h1 style="color:#fbbf24;font-size:20px;margin:0">Itukarua Corporate Billing</h1>
    <p style="color:#9ca3af;font-size:12px;margin:6px 0 0">Invoice ${escapeHtml(opts.invoiceNo)}</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Hi ${eCompany},</p>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">${eNote}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600;width:180px">Company</td><td style="padding:10px 12px">${eCompany}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Tier</td><td style="padding:10px 12px">${eTier || '—'}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Invoice No</td><td style="padding:10px 12px;font-family:monospace">${escapeHtml(opts.invoiceNo)}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Billing Period</td><td style="padding:10px 12px">${dueLabel(opts.periodStart)} — ${dueLabel(opts.periodEnd)}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Due Date</td><td style="padding:10px 12px">${dueLabel(opts.periodEnd)}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Amount Due</td><td style="padding:10px 12px;font-size:18px;font-weight:700;color:#059669">${amt}</td></tr>
    </table>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="font-weight:700;color:#111827;margin:0 0 10px">How to Pay via M-Pesa</p>
      <ol style="margin:0;padding-left:20px;color:#374151;line-height:1.9;font-size:14px">
        <li>Go to <strong>M-Pesa</strong> on your phone</li>
        <li>Select <strong>Lipa na M-Pesa</strong></li>
        <li>Choose <strong>Buy Goods and Services</strong> (Till)</li>
        <li>Enter Till No: <strong>${TILL_NO}</strong></li>
        <li>Amount: <strong>${amt}</strong></li>
      </ol>
      <p style="color:#6b7280;font-size:12px;margin:10px 0 0">Once your payment is confirmed your placements continue without interruption for the period shown above.</p>
    </div>
    ${opts.reportHtml || ''}
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0">Questions? Reply to this email or contact us at <a href="${SITE_URL}/contact" style="color:#059669;text-decoration:none">Itukarua Contact</a>.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent by Itukarua Classifieds · <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua</a></p>
  </td></tr>
</table>
</body>
</html>`
}

export function buildCorporateInvoiceText(opts: CorporateInvoiceRenderOpts): string {
  const amt = fmtKES(opts.amount)
  return `Itukarua Corporate Placement — Invoice ${opts.invoiceNo}

Hi ${opts.account.company_name},

${opts.note}

Company: ${opts.account.company_name}
Tier: ${opts.account.tier || '—'}
Invoice No: ${opts.invoiceNo}
Billing Period: ${dueLabel(opts.periodStart)} — ${dueLabel(opts.periodEnd)}
Due Date: ${dueLabel(opts.periodEnd)}
Amount Due: ${amt}

How to Pay via M-Pesa:
1. Go to M-Pesa on your phone
2. Select Lipa na M-Pesa
3. Choose Buy Goods and Services (Till)
4. Enter Till No: ${TILL_NO}
5. Amount: ${amt}

Questions? Contact us at ${SITE_URL}/contact
— Itukarua Classifieds`
}

// ─── Monthly analytics report section (included in the invoice email) ──────

export interface AdReportRow {
  title: string
  slot: string
  impressions: number
  clicks: number
  daily: { date: string; impressions: number; clicks: number }[]
}

export function buildReportHtml(rows: AdReportRow[], depth: 'basic' | 'full', periodLabel: string): string {
  if (rows.length === 0) {
    return `
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
  <p style="font-weight:700;color:#111827;margin:0 0 6px">Your July placement report</p>
  <p style="color:#6b7280;font-size:12px;margin:0">No impressions recorded yet in ${periodLabel}. Data appears once your placements start serving.</p>
</div>`
  }
  const totalImp = rows.reduce((s, r) => s + r.impressions, 0)
  const totalClk = rows.reduce((s, r) => s + r.clicks, 0)
  const rowsHtml = rows.map((r) => `
      <tr style="border-top:1px solid #f3f4f6">
        <td style="padding:8px 10px;color:#374151">${escapeHtml(r.title || 'Untitled')}</td>
        <td style="padding:8px 10px;color:#9ca3af;font-size:12px">${escapeHtml(r.slot)}</td>
        <td style="padding:8px 10px;text-align:right;color:#111827;font-weight:600">${r.impressions.toLocaleString()}</td>
        <td style="padding:8px 10px;text-align:right;color:#111827;font-weight:600">${r.clicks.toLocaleString()}</td>
      </tr>`).join('')

  let detailHtml = ''
  if (depth === 'full') {
    detailHtml = rows.map((r) => {
      const days = [...r.daily].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
      const list = days.map((d) => `<div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#6b7280">${escapeHtml(d.date)}</span><span style="color:#374151">${d.impressions} imp · ${d.clicks} clicks</span></div>`).join('')
      return `
      <div style="margin-top:14px">
        <p style="font-size:12px;font-weight:700;color:#111827;margin:0 0 6px">${escapeHtml(r.title || 'Untitled')} — daily detail</p>
        ${list || '<p style="font-size:12px;color:#9ca3af;margin:0">No daily data.</p>'}
      </div>`
    }).join('')
  }

  return `
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
  <p style="font-weight:700;color:#111827;margin:0 0 2px">Your placement report · ${escapeHtml(periodLabel)}</p>
  <p style="color:#6b7280;font-size:12px;margin:0 0 10px">${totalImp.toLocaleString()} impressions · ${totalClk.toLocaleString()} clicks across ${rows.length} placement(s)</p>
  <table style="width:100%;border-collapse:collapse">
    <tr style="background:#f3f4f6">
      <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Placement</th>
      <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Slot</th>
      <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Impr.</th>
      <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Clicks</th>
    </tr>
    ${rowsHtml}
  </table>
  <div style="margin-top:12px;border-top:2px solid #e5e7eb;padding-top:10px;font-size:13px;color:#111827">
    <div style="display:flex;justify-content:space-between"><span style="font-weight:700">Total</span><span style="font-weight:700">${totalImp.toLocaleString()} imp · ${totalClk.toLocaleString()} clicks</span></div>
  </div>
  ${detailHtml}
</div>`
}

// ─── Shared renewal + report data helpers (edge functions) ─────────────────

export const CORPORATE_PERIOD_DAYS = 30

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function dateISO(d: Date): string {
  return d.toISOString()
}

/** ad analytics for the account within [from, to] as report rows (full tier keeps daily detail). */
export async function corporateReportRows(
  supabase: any,
  accountId: string,
  from: Date,
  to: Date,
): Promise<AdReportRow[]> {
  const { data: ads } = await supabase
    .from('advertisements')
    .select('id, title, slot')
    .eq('corporate_account_id', accountId)
  const list: any[] = Array.isArray(ads) ? ads : []
  if (list.length === 0) return []

  const adIds = list.map((a) => a.id)
  const { data: evts } = await supabase
    .from('advert_analytics')
    .select('ad_id, event_type, created_at')
    .in('ad_id', adIds)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
  const events: any[] = Array.isArray(evts) ? evts : []

  return list.map((ad) => {
    const mine = events.filter((e) => e.ad_id === ad.id)
    const map: Record<string, { impressions: number; clicks: number }> = {}
    for (const e of mine) {
      const d = String(e.created_at).slice(0, 10)
      if (!map[d]) map[d] = { impressions: 0, clicks: 0 }
      if (e.event_type === 'click') map[d].clicks++
      else if (e.event_type === 'impression') map[d].impressions++
    }
    return {
      title: ad.title,
      slot: ad.slot,
      impressions: Object.values(map).reduce((s, v) => s + v.impressions, 0),
      clicks: Object.values(map).reduce((s, v) => s + v.clicks, 0),
      daily: Object.entries(map).map(([date, v]) => ({ date, ...v })),
    }
  })
}

/**
 * Apply a full corporate renewal: mark the matching invoice paid (when found),
 * advance next_billing_date by one period, and extend every placement's billing
 * window so ads resume serving. Never touches is_active (admin suspension stays
 * an explicit admin decision).
 */
export async function renewCorporate(
  supabase: any,
  accountId: string,
  opts: { invoiceId?: string | null; mpesaRef?: string | null; paidAt?: Date } = {},
): Promise<{ invoiceUpdated: boolean; nextBillingDate: string }> {
  const { data: account } = await supabase
    .from('corporate_accounts')
    .select('id, next_billing_date, billing_period, is_active')
    .eq('id', accountId)
    .single()
  if (!account) throw new Error('Corporate account not found')

  let invoiceUpdated = false
  {
    let query = supabase
      .from('corporate_invoices')
      .select('id, status')
      .eq('account_id', accountId)
    if (opts.invoiceId) {
      query = query.eq('id', opts.invoiceId)
    } else {
      query = query.in('status', ['issued', 'overdue']).order('period_start', { ascending: false }).limit(1)
    }
    const { data: inv } = await query.maybeSingle()
    if (inv) {
      await supabase
        .from('corporate_invoices')
        .update({
          status: 'paid',
          paid_at: (opts.paidAt || new Date()).toISOString(),
          mpesa_ref: opts.mpesaRef || null,
        })
        .eq('id', inv.id)
      invoiceUpdated = true
    }
  }

  const days = account.billing_period === 'weekly' ? 7 : CORPORATE_PERIOD_DAYS
  const baseRaw = account.next_billing_date ? new Date(`${account.next_billing_date}T00:00:00Z`) : new Date()
  const today = new Date()
  const base = baseRaw.getTime() > today.getTime() ? baseRaw : today
  const next = addDays(base, days)
  const nextIso = next.toISOString().slice(0, 10)

  await supabase
    .from('corporate_accounts')
    .update({ next_billing_date: nextIso })
    .eq('id', accountId)

  const { error: extErr } = await supabase.rpc('extend_corporate_ads', { p_account_id: accountId, p_days: days })
  if (extErr) throw new Error('extend_corporate_ads failed: ' + extErr.message)

  return { invoiceUpdated, nextBillingDate: nextIso }
}

// ─── Invoice composer (shared by issue-corporate-invoice + cron) ───────────

export interface MonthlyInvoiceResult {
  invoiceNo: string
  periodStart: string
  periodEnd: string
  amount: number
  recipient: string
  subject: string
  html: string
  text: string
}

export async function composeCorporateMonthlyInvoice(
  supabase: any,
  account: any,
  opts: { includeReport?: boolean; note?: string; defaultNote?: string } = {},
): Promise<MonthlyInvoiceResult> {
  const amount = corporateMonthlyAmount(account)
  const today = new Date()
  const periodStartRaw = account.next_billing_date ? new Date(`${account.next_billing_date}T00:00:00Z`) : today
  const periodStart = periodStartRaw.getTime() > today.getTime() ? periodStartRaw : today
  const periodEnd = addDays(periodStart, CORPORATE_PERIOD_DAYS - 1)
  const y = periodStart.getFullYear()
  const mm = String(periodStart.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase()
  const invoiceNo = `CORP-${y}${mm}-${rand}`

  const note = opts.note || opts.defaultNote || (
    (() => {
      const due = account.next_billing_date ? new Date(`${account.next_billing_date}T00:00:00Z`).getTime() : 0
      if (due < today.getTime()) {
        return 'Your monthly corporate placement subscription is due. Please pay below to renew your placements for the coming period — your advertising continues without interruption.'
      }
      return 'This is your invoice for the upcoming month of placements under your Itukarua corporate account.'
    })()
  )

  let recipient = account.billing_email || account.contact_email
  if (!recipient) {
    const { data: owners } = await supabase
      .from('corporate_members')
      .select('profile_id')
      .eq('account_id', account.id)
      .eq('member_role', 'owner')
      .limit(1)
    const ownerId = owners && owners[0]?.profile_id
    if (ownerId) {
      const { data: ownerProf } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', ownerId)
        .maybeSingle()
      recipient = ownerProf?.email || ''
    }
  }

  let reportHtml: string | undefined
  if (opts.includeReport) {
    const eff = effectivenessFor(account)
    const rows = await corporateReportRows(supabase, account.id, periodStart, today)
    reportHtml = buildReportHtml(rows, eff.analyticsDepth, periodStart.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' }))
  }

  const renderOpts = {
    account: { company_name: account.company_name, tier: account.tier },
    invoiceNo,
    periodStart,
    periodEnd,
    amount,
    note,
    reportHtml,
  }
  return {
    invoiceNo,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    amount,
    recipient,
    subject: corporateInvoiceSubject(account.company_name),
    html: buildCorporateInvoiceHtml(renderOpts),
    text: buildCorporateInvoiceText(renderOpts),
  }
}