import { createServiceClient, loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from '../_shared/smtp.ts'
import { authenticateCron } from '../_shared/cronAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const RENEWAL_WINDOW_MS = 48 * 60 * 60 * 1000 // email owners when a boost is inside the last 48h

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const identity = await authenticateCron(req)
    if (!identity) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createServiceClient()

    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const renewalFrom = new Date(now).toISOString()
    const renewalTo = new Date(now + RENEWAL_WINDOW_MS).toISOString()

    // ── 1. Expire boosts that have lapsed (products return to normal treatment) ──
    const { count: bannerExpired } = await supabase
      .from('advertisements')
      .update({ featured: false, boost_until: null })
      .not('boost_until', 'is', null)
      .lt('boost_until', nowIso)
      .eq('featured', true)

    const { count: serviceExpired } = await supabase
      .from('service_ads')
      .update({ featured: false, boost_until: null })
      .not('boost_until', 'is', null)
      .lt('boost_until', nowIso)
      .eq('featured', true)

    const { count: jobExpired } = await supabase
      .from('jobs')
      .update({ featured: false, boost_until: null })
      .not('boost_until', 'is', null)
      .lt('boost_until', nowIso)
      .eq('featured', true)

    // ── 1b. Switch off adverts whose billing window has lapsed ──
    // Expired placements must not keep an "active" flag claiming they serve.
    const { count: bannersDeactivated } = await supabase
      .from('advertisements')
      .update({ active: false }, { count: 'exact' })
      .eq('active', true)
      .not('billing_end', 'is', null)
      .lte('billing_end', nowIso)

    // ── 1c. System-retire deadline-expired job ads the employer ignored ──
    // A job whose application deadline passed 14+ days ago and is still open
    // is removed from the frontend and reported as "system retired".
    const retireCutoff = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { count: jobsRetired } = await supabase
      .from('jobs')
      .update({ retired_by: 'system', retired_at: nowIso }, { count: 'exact' })
      .eq('status', 'open')
      .is('retired_at', null)
      .lt('deadline', retireCutoff)

    // ── 2. Send renewal reminders for boosts expiring within the next 48h ──
    const reminders = await collectExpiring(supabase, renewalFrom, renewalTo)

    let renewalEmailsSent = 0
    let smtp: any
    try {
      smtp = await loadSmtpConfig(supabase)
    } catch (e) {
      console.error('SMTP not configured:', e)
    }
    const transport = smtp ? createFreshTransport(smtp) : null

    if (reminders.length > 0 && transport && smtp) {
      for (const r of reminders) {
        const sent = await sendRenewalEmail(transport, smtp, r)
        if (sent) {
          renewalEmailsSent++
          await supabase.from('boost_renewal_notices').insert({
            item_table: r.table,
            item_id: r.id,
            boost_until: r.boostUntil,
          })
        }
      }
    }

    // ── 3. Tell owners when the advert itself has run out ──
    // Boost expiry above only downgrades a listing back to normal treatment. The
    // advert coming off the site entirely is a separate, much more important
    // event, and it used to be silent: the owner just found their listing gone
    // with no idea why. expired_notified_at keeps this to exactly one email per
    // paid term, and a renewal clears it so the next term notifies again.
    const expiredWindows = await collectExpiredWindows(supabase, nowIso)
    let expiryEmailsSent = 0
    if (expiredWindows.length > 0 && transport && smtp) {
      for (const item of expiredWindows) {
        const sent = await sendExpiryEmail(transport, smtp, item)
        if (sent) {
          expiryEmailsSent++
          // Only mark once the mail is actually away, so a SMTP outage does not
          // silently swallow the notice.
          await supabase
            .from(item.table)
            .update({ expired_notified_at: nowIso })
            .eq('id', item.id)
            .is('expired_notified_at', null)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        bannerExpired,
        serviceExpired,
        jobExpired,
        bannersDeactivated,
        jobsRetired,
        renewalReminders: reminders.length,
        renewalEmailsSent,
        expiredWindows: expiredWindows.length,
        expiryEmailsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

type Reminder = {
  table: 'advertisements' | 'service_ads' | 'jobs'
  id: string
  title: string
  boostUntil: string
  email: string | null
  ownerTitle: string
}

async function collectExpiring(supabase: any, from: string, to: string): Promise<Reminder[]> {
  const query = (table: string, extra: string) =>
    supabase
      .from(table)
      .select(extra)
      .eq('featured', true)
      .not('boost_until', 'is', null)
      .gte('boost_until', from)
      .lt('boost_until', to)

  const [banners, services, jobs] = await Promise.all([
    query('advertisements', 'id,title,boost_until,owner_email,owner_id'),
    query('service_ads', 'id,business_name,boost_until,owner_email,owner_id'),
    query('jobs', 'id,title,boost_until,posted_by,posted_by_name'),
  ])

  // Resolve owner emails from profiles for items that have an owner user.
  const userIds = new Set<string>()
  ;(services.data || []).forEach((s: any) => s.owner_id && userIds.add(s.owner_id))
  ;(jobs.data || []).forEach((j: any) => j.posted_by && userIds.add(j.posted_by))
  ;(banners.data || []).forEach((b: any) => b.owner_id && userIds.add(b.owner_id))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,email')
    .in('id', Array.from(userIds))
  const emailByOwner = new Map<string, string | null>()
  ;(profiles || []).forEach((p: any) => emailByOwner.set(p.id, p.email || null))

  const reminders: Reminder[] = []
  const seen = (await supabase
    .from('boost_renewal_notices')
    .select('item_table,item_id,boost_until')).data || []
  const notified = new Set(seen.map((n: any) => `${n.item_table}:${n.item_id}:${n.boost_until}`))

  const add = (r: Reminder) => {
    const key = `${r.table}:${r.id}:${r.boostUntil}`
    if (!notified.has(key) && r.email) reminders.push(r)
  }

  for (const b of banners.data || []) {
    add({
      table: 'advertisements',
      id: b.id,
      title: b.title || 'Banner advert',
      boostUntil: b.boost_until,
      email: b.owner_email || (b.owner_id ? emailByOwner.get(b.owner_id) : null) || null,
      ownerTitle: b.title || 'Your banner advert',
    })
  }
  for (const s of services.data || []) {
    add({
      table: 'service_ads',
      id: s.id,
      title: s.business_name || 'Service advert',
      boostUntil: s.boost_until,
      email: s.owner_email || (s.owner_id ? emailByOwner.get(s.owner_id) : null) || null,
      ownerTitle: s.business_name || 'Your service advert',
    })
  }
  for (const j of jobs.data || []) {
    add({
      table: 'jobs',
      id: j.id,
      title: j.title || 'Job post',
      boostUntil: j.boost_until,
      email: j.posted_by ? emailByOwner.get(j.posted_by) || null : null,
      ownerTitle: j.posted_by_name || j.title || 'Your job post',
    })
  }

  return reminders
}

type ExpiredWindow = {
  table: 'advertisements' | 'service_ads'
  id: string
  title: string
  plan: string | null
  expiredOn: string
  days: number | null
  email: string | null
}

/**
 * Paid adverts whose term has run out and that have not been told yet.
 *
 * Only paid rows: an advert that was created and never paid for is not
 * "expired", it is waiting for its first payment, and mailing the owner about
 * that would be noise.
 */
async function collectExpiredWindows(supabase: any, nowIso: string): Promise<ExpiredWindow[]> {
  const [banners, services] = await Promise.all([
    supabase
      .from('advertisements')
      .select('id,title,billing_cycle,billing_end,owner_email,owner_id,payment_confirmed,expired_notified_at')
      .not('billing_end', 'is', null)
      .lte('billing_end', nowIso)
      .eq('payment_confirmed', true)
      .is('expired_notified_at', null),
    supabase
      .from('service_ads')
      .select('id,business_name,plan,billing_end,owner_email,owner_id,payment_confirmed,expired_notified_at')
      .not('billing_end', 'is', null)
      .lte('billing_end', nowIso)
      .eq('payment_confirmed', true)
      .is('expired_notified_at', null),
  ])

  const userIds = new Set<string>()
  ;(services.data || []).forEach((s: any) => s.owner_id && userIds.add(s.owner_id))
  ;(banners.data || []).forEach((b: any) => b.owner_id && userIds.add(b.owner_id))
  const { data: profiles } = userIds.size
    ? await supabase.from('profiles').select('id,email').in('id', Array.from(userIds))
    : { data: [] }
  const emailByOwner = new Map<string, string | null>()
  ;(profiles || []).forEach((p: any) => emailByOwner.set(p.id, p.email || null))

  const out: ExpiredWindow[] = []
  for (const b of banners.data || []) {
    out.push({
      table: 'advertisements',
      id: b.id,
      title: b.title || 'Your banner advert',
      plan: b.billing_cycle || null,
      expiredOn: b.billing_end,
      days: null,
      email: b.owner_email || (b.owner_id ? emailByOwner.get(b.owner_id) : null) || null,
    })
  }
  for (const s of services.data || []) {
    out.push({
      table: 'service_ads',
      id: s.id,
      title: s.business_name || 'Your service advert',
      plan: s.plan || null,
      expiredOn: s.billing_end,
      days: s.plan ? parseInt(String(s.plan).replace(/[^0-9]/g, ''), 10) || null : null,
      email: s.owner_email || (s.owner_id ? emailByOwner.get(s.owner_id) : null) || null,
    })
  }
  return out.filter((x) => !!x.email)
}

const RENEWAL_PRICES: Record<string, string> = {
  '10-day': 'KES 300 for 10 days',
  '20-day': 'KES 500 for 20 days',
  '30-day': 'KES 800 for 30 days',
}

async function sendExpiryEmail(transport: any, smtp: any, item: ExpiredWindow): Promise<boolean> {
  const expiredOn = new Date(item.expiredOn).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const renewal = item.plan ? RENEWAL_PRICES[item.plan] : null
  const eTitle = escapeHtml(item.title)

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb">
  <tr><td style="background:#b91c1c;padding:24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">Your advert has expired</h1>
    <p style="color:#fee2e2;font-size:12px;margin:6px 0 0">${eTitle} is no longer showing on the site</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Hi ${eTitle},</p>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Your paid term ended on <strong>${expiredOn}</strong>, so <strong>${eTitle}</strong> is no longer visible to visitors. Nothing has been deleted — renewing puts it back exactly as it was, without reposting.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600;width:160px">Advert</td><td style="padding:10px 12px">${eTitle}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Expired on</td><td style="padding:10px 12px">${expiredOn}</td></tr>
      ${renewal ? `<tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Renewal</td><td style="padding:10px 12px;color:#059669;font-weight:700">${renewal}</td></tr>` : ''}
    </table>
    <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Renew this advert →</a>
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:16px 0 0">Renewing adds your new days on top of the expiry date, so you only pay for the days you have actually used.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent by Itukarua Classifieds · <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua</a></p>
  </td></tr>
</table>
</body>
</html>`

  const text = `Your advert has expired

Hi ${item.title},

Your paid term ended on ${expiredOn}, so "${item.title}" is no longer visible on the site. Nothing has been deleted — renewing puts it back exactly as it was, without reposting.

Advert: ${item.title}
Expired on: ${expiredOn}
${renewal ? `Renewal: ${renewal}\n` : ''}
Renew here: ${SITE_URL}/dashboard

Renewing adds your new days on top of the expiry date, so you only pay for the days you have actually used.

— Itukarua Classifieds`

  try {
    await transport.sendMail({
      from: smtp.from,
      to: item.email,
      subject: `Your Itukarua advert has expired — ${item.title}`,
      text,
      html,
    })
    return true
  } catch (err) {
    console.error('Failed to send expiry notice for', item.id, err)
    return false
  }
}

async function sendRenewalEmail(transport: any, smtp: any, r: Reminder): Promise<boolean> {
  const daysLeft = Math.max(1, Math.ceil((new Date(r.boostUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
  const eOwner = escapeHtml(r.ownerTitle)
  const eTitle = escapeHtml(r.title)

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb">
  <tr><td style="background:#059669;padding:24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">Itukarua Featured Boost — Renewal</h1>
    <p style="color:#d1fae5;font-size:12px;margin:6px 0 0">Your boost ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Hi ${eOwner},</p>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Your featured boost for <strong>${eTitle}</strong> is ending soon. This product is currently shown to thousands of visitors at the top of searches and on the homepage. Without a renewal it will be treated like any other listing after expiry.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600;width:160px">Product</td><td style="padding:10px 12px">${eTitle}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Boost Ends</td><td style="padding:10px 12px">${new Date(r.boostUntil).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Renewal</td><td style="padding:10px 12px;color:#059669;font-weight:700">KES 500 for another 7 days</td></tr>
    </table>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="font-weight:700;color:#111827;margin:0 0 10px">How to Renew via M-Pesa</p>
      <ol style="margin:0;padding-left:20px;color:#374151;line-height:1.9;font-size:14px">
        <li>Sign in to <a href="${SITE_URL}/dashboard" style="color:#059669">your Itukarua Portal</a></li>
        <li>Go to <strong>Our Products → Featured Boost</strong> and pick ${eTitle}</li>
        <li>Or open<strong> M-Pesa</strong>, choose <strong>Buy Goods and Services</strong> (Till)</li>
        <li>Enter Till No: <strong>1600149</strong>, Amount: <strong>KES 500</strong></li>
      </ol>
      <p style="color:#6b7280;font-size:12px;margin:10px 0 0">Your payment extends this boost by 7 days automatically.</p>
    </div>
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0">Questions? Reply to this email or contact us at <a href="${SITE_URL}/contact" style="color:#059669;text-decoration:none">Itukarua Contact</a>.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent by Itukarua Classifieds · <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua</a></p>
  </td></tr>
</table>
</body>
</html>`

  const text = `Itukarua Featured Boost — Renewal

Hi ${r.ownerTitle},

Your featured boost for "${r.title}" ends in ${daysLeft} day(s). Without renewal the product returns to regular listing order.

Product: ${r.title}
Boost ends: ${new Date(r.boostUntil).toLocaleDateString('en-KE')}
Renewal: KES 500 for another 7 days

How to renew via M-Pesa:
1. Sign in to ${SITE_URL}/dashboard
2. Go to Our Products → Featured Boost and pick the product
3. Or open M-Pesa → Buy Goods and Services (Till)
4. Enter Till No: 1600149, Amount: KES 500

Your payment extends the boost by 7 days automatically.

Questions? Contact us at ${SITE_URL}/contact
— Itukarua Classifieds`

  try {
    await transport.sendMail({
      from: smtp.from,
      to: r.email,
      subject: `Itukarua Featured Boost — Renewal reminder (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`,
      text,
      html,
    })
    return true
  } catch (err) {
    console.error('Failed to send boost renewal to', r.email, err)
    return false
  }
}