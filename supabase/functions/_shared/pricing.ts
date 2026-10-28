// Server-authoritative product prices.
//
// The browser chooses which product it wants; it does not choose what that
// product costs. Every amount is checked against these prices when the STK push
// is created, and again before fulfilment grants anything, so a tampered
// request — or a row created by the old client-insert payment policy — cannot
// buy a full entitlement for KES 1.
//
// Prices mirror src/data/siteData.ts and src/lib/database.ts.

export const BOOST_PRICE_KES = 500

export const SERVICE_PLAN_KES = {
  '10-day': 300,
  '20-day': 500,
  '30-day': 800,
} as const

export type ServicePlanPrice = keyof typeof SERVICE_PLAN_KES

// Day-based products: 1-day job token, weekly employer access, and the three
// listing/advert plans (both use the same 10/20/30-day amounts).
const DAY_PRICE_KES: Record<number, number> = {
  1: 100,
  7: 200,
  10: 300,
  20: 500,
  30: 800,
}

const DEFAULT_JOBSEEKER_REGISTRATION_KES = 100
const EMPLOYER_WEEKLY_KES = 200
const DEFAULT_CONTACT_ACCESS_KES = 100
const DEFAULT_ADVERT_KES = 300

function metaOf(payment: { metadata?: Record<string, any> | null }): Record<string, any> {
  return payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}
}

async function settingKes(supabase: any, key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from('platform_settings').select('value').eq('key', key).maybeSingle()
  const n = Number(data?.value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback
}

/**
 * Minimum amount, in whole KES, that a payment of this type must cover.
 *
 * Returns null for products whose price is not a constant: corporate invoices
 * (the invoice amount is enforced separately), admin-only test payments, and
 * legacy types that fulfil nothing.
 */
export async function minimumAmountKes(
  supabase: any,
  payment: { payment_type: string; metadata?: Record<string, any> | null },
  profileRole?: string | null,
): Promise<number | null> {
  const meta = metaOf(payment)
  const days = Number(meta.days)

  switch (payment.payment_type) {
    case 'registration': {
      // Employer Weekly is 200; the 1-day employer product and every jobseeker
      // subscription (premium monthly/weekly) start at 100.
      const role = typeof meta.role === 'string' && meta.role ? meta.role : profileRole
      const employerWeekly = role === 'employer' && (!Number.isFinite(days) || days > 1)
      return employerWeekly ? EMPLOYER_WEEKLY_KES : DEFAULT_JOBSEEKER_REGISTRATION_KES
    }

    case 'employer_day_access':
    case 'employer_day_token':
      return DAY_PRICE_KES[1]

    case 'job_listing':
      // Metadata is authoritative; older clients without it get the 1-day
      // token price, which is all an amount below 300 grants anyway.
      return Number.isFinite(days) && DAY_PRICE_KES[days] ? DAY_PRICE_KES[days] : DAY_PRICE_KES[1]

    case 'advert': {
      const plan = meta.plan
      if (typeof plan === 'string' && plan in SERVICE_PLAN_KES) {
        return SERVICE_PLAN_KES[plan as ServicePlanPrice]
      }
      // 7-day banner cycles are 200; 1-day is not a permitted advert term
      // (fulfilment would read any amount under 300 as the 10-day plan).
      if (days === 7 || days === 10 || days === 20 || days === 30) return DAY_PRICE_KES[days]
      // No structured plan: the lowest real advert plan, never a discount.
      return DEFAULT_ADVERT_KES
    }

    case 'contact_access':
      return settingKes(supabase, 'contact_access_fee', DEFAULT_CONTACT_ACCESS_KES)

    case 'featured_boost':
      return BOOST_PRICE_KES

    default:
      return null
  }
}

export function underpaymentMessage(expected: number, received: number): string {
  return `Underpayment: this product costs KES ${expected}, received KES ${received}.`
}
