import { createServiceClient, loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from '../_shared/smtp.ts'
import { composeCorporateMonthlyInvoice } from '../_shared/corporateBilling.ts'
import { authenticateCron } from '../_shared/cronAuth.ts'

// ─── Cron runner: monthly corporate invoicing + admin digest ───────────────
//  - Triggered by the GitHub Actions cron workflow sending the service-role
//    key as a bearer token (or any cron caller presenting the x-cron-secret
//    matching the CRON_SECRET env var).
//  - Or manually by a super_admin with a valid bearer token.
//  - Invoices every ACTIVE corporate account whose next_billing_date is due;
//    reports overdue (>7d)/suspended/due-soon accounts to admins by email.

const ALLOWED_ORIGINS = ['https://www.itukarua.co.ke', 'https://itukarua3.vercel.app', 'http://localhost:8080']

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  }
}

function json(data: any, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function adminEmails(supabase: any): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('email').eq('role', 'super_admin')
  return (data || []).map((p: any) => p.email).filter(Boolean) as string[]
}

async function persistInvoice(supabase: any, account: any, inv: any): Promise<boolean> {
  const { data: existing } = await supabase
    .from('corporate_invoices')
    .select('id')
    .eq('account_id', account.id)
    .eq('period_start', inv.periodStart.slice(0, 10))
    .maybeSingle()
  if (existing) return false // already issued this period

  const { data: row } = await supabase.from('corporate_invoices').insert({
    account_id: account.id,
    invoice_no: inv.invoiceNo,
    period_start: inv.periodStart.slice(0, 10),
    period_end: inv.periodEnd.slice(0, 10),
    amount: inv.amount,
    currency: 'KES',
    status: 'issued',
    purpose: 'monthly',
    sent_to: inv.recipient,
    sent_at: new Date().toISOString(),
  }).select('id').single()
  if (!row) return false

  await supabase.from('corporate_accounts').update({ last_invoice_at: new Date().toISOString() }).eq('id', account.id)
  // Inserted as 'pending' — the digest is only flipped to 'sent' once the mail
  // is actually away, so a SMTP outage is retried on the next daily run instead
  // of being silently recorded as delivered.
  await supabase.from('billing_notifications').insert({
    item_type: 'corporate',
    item_id: account.id,
    business_name: account.company_name,
    recipient_email: inv.recipient,
    subject: inv.subject,
    amount: inv.amount || null,
    due_date: inv.periodEnd.slice(0, 10),
    status: 'pending',
  })
  return true
}

// Sends the invoice email for a corporate account's current period, marking the
// billing_notifications row delivered only after the message actually goes out.
async function ensureInvoiceEmail(supabase: any, account: any, inv: any): Promise<{ sent: boolean; skip?: boolean; reason?: string }> {
  const { data: notice } = await supabase
    .from('billing_notifications')
    .select('id,status')
    .eq('item_type', 'corporate')
    .eq('item_id', account.id)
    .eq('due_date', inv.periodEnd.slice(0, 10))
    .maybeSingle()
  if (notice?.status === 'sent') return { sent: false, skip: true }

  try {
    const smtp = await loadSmtpConfig(supabase)
    const transport = createFreshTransport(smtp)
    await transport.sendMail({ from: smtp.from, to: inv.recipient, subject: inv.subject, html: inv.html, text: inv.text })
    if (notice) {
      await supabase.from('billing_notifications').update({ status: 'sent' }).eq('id', notice.id)
    }
    return { sent: true }
  } catch (e: any) {
    if (notice) {
      await supabase.from('billing_notifications').update({ status: 'failed' }).eq('id', notice.id)
    }
    return { sent: false, reason: e?.message || 'SMTP send failed' }
  }
}

function fmtKES(n: number): string {
  return `KES ${Number(n || 0).toLocaleString('en-KE')}`
}

async function sendDigest(supabase: any, recipients: string[], sections: { title: string; tone: string; rows: { company: string; tier: string; date: string; amount: string }[] }[]) {
  if (recipients.length === 0) return
  const smtp = await loadSmtpConfig(supabase)
  const transport = createFreshTransport(smtp)

  const sectionsHtml = sections.map((s) => {
    if (s.rows.length === 0) return ''
    const rowsHtml = s.rows.map((r) => `
      <tr style="border-top:1px solid #f3f4f6">
        <td style="padding:8px 10px;color:#111827;font-weight:600">${escapeHtml(r.company)}</td>
        <td style="padding:8px 10px;color:#374151;text-transform:capitalize">${escapeHtml(r.tier)}</td>
        <td style="padding:8px 10px;color:#6b7280;font-size:12px">${escapeHtml(r.date)}</td>
        <td style="padding:8px 10px;color:#374151;font-size:12px">${escapeHtml(r.amount)}</td>
      </tr>`).join('')
    return `
    <div style="margin-top:16px">
      <p style="font-weight:700;color:#111827;margin:0 0 6px">${escapeHtml(s.title)} (${s.rows.length})</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <tr style="background:#f3f4f6">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Company</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Tier</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Next billing</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Monthly amount</th>
        </tr>
        ${rowsHtml}
      </table>
    </div>`
  }).filter(Boolean).join('')

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb">
  <tr><td style="background:linear-gradient(135deg,#111827,#1f2937);padding:26px;text-align:center">
    <h1 style="color:#fbbf24;font-size:18px;margin:0">Corporate Billing — Daily Digest</h1>
    <p style="color:#9ca3af;font-size:12px;margin:6px 0 0">${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="color:#374151;line-height:1.6;margin:0 0 4px">Hi Itukarua Admin,</p>
    <p style="color:#374151;line-height:1.6;margin:0">Here is today's corporate account status. Overdue and suspended accounts may need attention; due-soon accounts are invoiced automatically.</p>
    ${sectionsHtml || '<p style="color:#9ca3af;margin-top:8px">All corporate accounts are up to date.</p>'}
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:16px 0 0">Manage corporate accounts in <a href="${SITE_URL}/admin" style="color:#059669;text-decoration:none">Itukarua Admin</a>.</p>
  </td></tr>
</table>
</body>
</html>`

  await transport.sendMail({
    from: smtp.from,
    to: recipients.join(', '),
    subject: `Itukarua — Corporate Billing Digest (${new Date().toLocaleDateString('en-KE')})`,
    html,
    text: `Itukarua Corporate Billing Digest.\n${sections.map((s) => `${s.title} (${s.rows.length}): ${s.rows.map((r) => r.company).join(', ')}`).join('\n')}`,
  })
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const identity = await authenticateCron(req)
    if (!identity) return json({ error: 'Forbidden' }, 403, cors)

    const supabase = createServiceClient()
    const todayIso = new Date().toISOString().slice(0, 10)
    const nowMs = Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

    const { data: accounts } = await supabase.from('corporate_accounts').select('*').order('company_name', { ascending: true })
    const list: any[] = Array.isArray(accounts) ? accounts : []

    const invoiced: any[] = []
    const errors: any[] = []
    const overdueStale: any[] = []
    const suspended: any[] = []
    const dueSoon: any[] = []

    for (const account of list) {
      const nextMs = account.next_billing_date
        ? new Date(`${account.next_billing_date}T00:00:00Z`).getTime()
        : 0
      const overdueMs = nowMs - nextMs
      const amount = account.custom_amount || account.monthly_price || undefined

      if (account.is_active === false) {
        suspended.push({ company: account.company_name, tier: account.tier, date: account.next_billing_date || '—', amount: amount != null ? fmtKES(amount) : '—' })
        continue
      }
      if (nextMs > 0 && overdueMs > sevenDaysMs) {
        overdueStale.push({ company: account.company_name, tier: account.tier, date: account.next_billing_date || '—', amount: amount != null ? fmtKES(amount) : '—' })
        continue
      }
      if (nextMs > 0 && nextMs <= nowMs) {
        // Music of the month — issue a fresh invoice for this overdue period.
        try {
          const inv = await composeCorporateMonthlyInvoice(supabase, account, { includeReport: true })
          if (!inv.recipient) {
            errors.push({ company: account.company_name, error: 'No billing email on file' })
            continue
          }
          const created = await persistInvoice(supabase, account, inv)
          const email = await ensureInvoiceEmail(supabase, account, inv)
          if (created && email.sent) {
            invoiced.push({ company: account.company_name, amount: inv.amount, invoice_no: inv.invoiceNo })
          } else if (!email.skip) {
            errors.push({ company: account.company_name, error: email.reason || 'invoice email not delivered' })
          }
        } catch (e: any) {
          errors.push({ company: account.company_name, error: e.message })
        }
        continue
      }
      // Due within the week, or no schedule configured yet (needs attention).
      if (nextMs === 0 || nextMs - nowMs <= sevenDaysMs) {
        dueSoon.push({ company: account.company_name, tier: account.tier, date: account.next_billing_date || '—', amount: amount != null ? fmtKES(amount) : '—' })
      }
    }

    // Reminder emails were already sent by the cron; the digest reaches admins every run.
    const recipients = await adminEmails(supabase)
    await sendDigest(supabase, recipients, [
      { title: 'Overdue — payments running behind (>7 days)', tone: 'danger', rows: overdueStale },
      { title: 'Suspended — need manual revival', tone: 'danger', rows: suspended },
      { title: 'Due within 7 days', tone: 'amber', rows: dueSoon },
    ])

    return json({
      ok: true,
      run: new Date().toISOString(),
      invoiced,
      errors,
      counts: {
        invoiced: invoiced.length,
        errors: errors.length,
        overdueStale: overdueStale.length,
        suspended: suspended.length,
        dueSoon: dueSoon.length,
      },
      today: todayIso,
    }, 200, cors)
  } catch (err: any) {
    return json({ error: err.message }, 500, cors)
  }
})