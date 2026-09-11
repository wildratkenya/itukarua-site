import { createServiceClient, loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from '../_shared/smtp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RENEWAL_WINDOW_MS = 48 * 60 * 60 * 1000 // email owners when a boost is inside the last 48h

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // ── 2. Send renewal reminders for boosts expiring within the next 48h ──
    const reminders = await collectExpiring(supabase, renewalFrom, renewalTo)

    let renewalEmailsSent = 0
    if (reminders.length > 0) {
      let smtp: any
      try {
        smtp = await loadSmtpConfig(supabase)
      } catch (e) {
        console.error('SMTP not configured for boost renewals:', e)
      }
      if (smtp) {
        const transport = createFreshTransport(smtp)
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        bannerExpired,
        serviceExpired,
        jobExpired,
        renewalReminders: reminders.length,
        renewalEmailsSent,
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