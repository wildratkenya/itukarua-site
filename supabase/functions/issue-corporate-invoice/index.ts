import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createServiceClient, loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from '../_shared/smtp.ts'
import { composeCorporateMonthlyInvoice, renewCorporate } from '../_shared/corporateBilling.ts'
import { corsHeadersFor } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

function json(data: any, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// User-scoped client (RLS enforces owner/member visibility).
function userClient(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

async function getCaller(token: string): Promise<{ userId: string | null; isAdmin: boolean }> {
  const supabase = userClient(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, isAdmin: false }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return { userId: user.id, isAdmin: profile?.role === 'super_admin' }
}

async function resolveAccounts(supabase: any, accountIds?: string[]): Promise<any[]> {
  const { data } = accountIds && accountIds.length
    ? await supabase.from('corporate_accounts').select('*').in('id', accountIds)
    : await supabase.from('corporate_accounts').select('*').order('company_name', { ascending: true })
  return (data || []) as any[]
}

async function logNotification(supabase: any, account: any, invNo: string, recipient: string, subject: string, amount: number, periodEnd: string) {
  await supabase.from('billing_notifications').insert({
    item_type: 'corporate',
    item_id: account.id,
    business_name: account.company_name,
    recipient_email: recipient,
    subject,
    amount: amount || null,
    due_date: periodEnd.slice(0, 10),
    status: 'sent',
  })
}

async function persistInvoice(supabase: any, account: any, inv: any) {
  // One invoice per account per period (unique account_id + period_start).
  // Reuse an existing issued invoice for the same period so re-sends don't churn.
  const { data: existing } = await supabase
    .from('corporate_invoices')
    .select('id, invoice_no')
    .eq('account_id', account.id)
    .eq('period_start', inv.periodStart.slice(0, 10))
    .maybeSingle()
  if (existing) {
    await supabase.from('corporate_invoices').update({ sent_at: new Date().toISOString(), sent_to: inv.recipient }).eq('id', existing.id)
    return existing.invoice_no
  }
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
  }).select('invoice_no').single()
  await supabase.from('corporate_accounts').update({ last_invoice_at: new Date().toISOString() }).eq('id', account.id)
  return row?.invoice_no || inv.invoiceNo
}

async function sendTo(recipient: string, subject: string, html: string, text: string) {
  const supabase = createServiceClient()
  const smtp = await loadSmtpConfig(supabase)
  const transport = createFreshTransport(smtp)
  await transport.sendMail({ from: smtp.from, to: recipient, subject, html, text })
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { action, account_ids, include_report, note, invoice_id, mpesa_ref } = body
    const auth = req.headers.get('Authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')

    if (!token) return json({ error: 'Unauthorized' }, 401, cors)
    const caller = await getCaller(token)
    if (!caller.userId) return json({ error: 'Unauthorized' }, 401, cors)

    const adminSupabase = createServiceClient()

    if (action === 'mark_paid') {
      if (!caller.isAdmin) return json({ error: 'Admins only' }, 403, cors)
      const accountId = body.account_id
      if (!accountId) return json({ error: 'account_id required' }, 400, cors)
      const result = await renewCorporate(adminSupabase, accountId, { invoiceId: invoice_id || null, mpesaRef: mpesa_ref || null })
      return json({ ok: true, ...result }, 200, cors)
    }

    const accounts = await resolveAccounts(adminSupabase, account_ids)
    if (!accounts.length) return json({ error: 'No matching corporate accounts' }, 404, cors)

    if (action === 'all' && !caller.isAdmin) {
      return json({ error: 'Admins only' }, 403, cors)
    }

    if (action === 'preview' || action === 'send') {
      // Owner of the account may preview/send their own invoice.
      if (!caller.isAdmin) {
        const userSupabase = userClient(token)
        for (const acct of accounts) {
          const { data: isOwner } = await userSupabase.rpc('is_corporate_owner', { p_account_id: acct.id })
          if (!isOwner) return json({ error: 'Only an account owner or admin may access this account', account_id: acct.id }, 403, cors)
        }
      }
    }

    const results: any[] = []
    let sent = 0
    let skipped = 0

    for (const account of accounts) {
      const inv = await composeCorporateMonthlyInvoice(adminSupabase, account, {
        includeReport: include_report ?? true,
        note: note || undefined,
      })
      if (!inv.recipient && action !== 'preview') {
        skipped++
        results.push({ account_id: account.id, company_name: account.company_name, ok: false, error: 'No billing email on file' })
        continue
      }
      const preview = {
        account_id: account.id,
        company_name: account.company_name,
        tier: account.tier,
        amount: inv.amount,
        invoice_no: inv.invoiceNo,
        period_start: inv.periodStart.slice(0, 10),
        period_end: inv.periodEnd.slice(0, 10),
        recipient: inv.recipient || null,
        subject: inv.subject,
        html: inv.html,
        text: inv.text,
      }
      if (action === 'preview') {
        results.push({ ...preview, preview: true })
        continue
      }
      try {
        await sendTo(inv.recipient, inv.subject, inv.html, inv.text)
        const invoiceNo = await persistInvoice(adminSupabase, account, inv)
        await logNotification(adminSupabase, account, invoiceNo, inv.recipient, inv.subject, inv.amount, inv.periodEnd)
        sent++
        results.push({ account_id: account.id, company_name: account.company_name, ok: true, invoice_no: invoiceNo, sent_to: inv.recipient })
      } catch (e: any) {
        skipped++
        results.push({ account_id: account.id, company_name: account.company_name, ok: false, error: e.message })
      }
    }

    return json({ action, sent, skipped, results }, 200, cors)
  } catch (err: any) {
    return json({ error: err.message }, 500, cors)
  }
})