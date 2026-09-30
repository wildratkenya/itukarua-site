// Daily safety net for payment fulfilment.
//
// The Daraja callback is the fast path and the browser poll is the second net,
// but neither is guaranteed: Safaricom retries a timed-out callback and then
// gives up, and a function can be killed mid-dispatch. Any payment that reached
// 'completed' without its effects being applied shows up here as
// effects_applied_at IS NULL and gets repaired.
//
// Before this existed, a customer in that state was charged and simply never
// received what they paid for. Run it daily. Authentication is fail-closed:
// the caller must present the service-role key, the x-cron-secret, or a
// super_admin bearer token (see _shared/cronAuth.ts).

import { createServiceClient, loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from '../_shared/smtp.ts'
import { reconcileUnappliedPayments, paymentLabel, type ReconcileRow } from '../_shared/paymentEffects.ts'
import { authenticateCron } from '../_shared/cronAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function notifyOps(supabase: any, rows: ReconcileRow[]): Promise<void> {
  const failed = rows.filter((r) => !r.ok)
  const repaired = rows.filter((r) => r.ok)
  if (repaired.length === 0 && failed.length === 0) return

  const { data: admins } = await supabase.from('profiles').select('email').eq('role', 'super_admin')
  const recipients = (admins || []).map((p: any) => p.email).filter(Boolean) as string[]
  if (recipients.length === 0) {
    console.error('[reconcile] no super_admin recipient for repair notification')
    return
  }

  let smtp: any
  try {
    smtp = await loadSmtpConfig(supabase)
  } catch (e) {
    console.error('[reconcile] SMTP not configured for ops notification:', e)
    return
  }

  const list = (items: ReconcileRow[], ok: boolean) =>
    items
      .map(
        (r) =>
          `<tr><td style="padding:8px 10px;font-family:monospace;font-size:12px">${r.id}</td>` +
          `<td style="padding:8px 10px">${escapeHtml(paymentLabel(r.payment_type))}</td>` +
          `<td style="padding:8px 10px;text-align:right">KES ${Number(r.amount || 0).toLocaleString()}</td>` +
          `<td style="padding:8px 10px;color:${ok ? '#059669' : '#b91c1c'}">${ok ? escapeHtml((r.effects || []).join(', ') || 'applied') : escapeHtml(r.error || 'failed')}</td></tr>`,
      )
      .join('')

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb">
  <tr><td style="background:#111827;padding:22px;text-align:center">
    <h1 style="color:#fff;font-size:18px;margin:0">Payment Fulfilment Repaired</h1>
    <p style="color:#9ca3af;font-size:12px;margin:6px 0 0">${new Date().toLocaleString('en-KE')}</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="color:#374151;font-size:14px;margin:0 0 16px">
      ${repaired.length} payment(s) had been taken but never fulfilled and have now been applied.
      ${failed.length ? `<strong style="color:#b91c1c">${failed.length} could not be repaired and need manual attention.</strong>` : 'All repairs succeeded.'}
    </p>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f3f4f6">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280">Payment</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280">Type</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280">Amount</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280">Result</th>
      </tr>
      ${repaired.length ? list(repaired, true) : ''}
      ${failed.length ? list(failed, false) : ''}
    </table>
    <a href="${SITE_URL}/admin" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Open /admin</a>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    'Itukarua — payment fulfilment repaired',
    new Date().toString(),
    '',
    `${repaired.length} repaired, ${failed.length} failed.`,
    ...rows.map(
      (r) =>
        `- ${r.id} ${paymentLabel(r.payment_type)} KES ${Number(r.amount || 0)} — ${r.ok ? (r.effects || []).join(', ') : r.error}`,
    ),
    '',
    `${SITE_URL}/admin`,
  ].join('\n')

  try {
    const transport = createFreshTransport(smtp)
    await transport.sendMail({
      from: smtp.from,
      to: recipients.join(', '),
      subject: `Itukarua — ${repaired.length} payment(s) repaired${failed.length ? `, ${failed.length} FAILED` : ''}`,
      text,
      html,
    })
  } catch (err) {
    console.error('[reconcile] ops email failed:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const identity = await authenticateCron(req)
  if (!identity) return unauthorized()

  try {
    const supabase = createServiceClient()
    const rows = await reconcileUnappliedPayments(supabase)

    if (rows.length > 0) {
      await notifyOps(supabase, rows)
    }

    const repaired = rows.filter((r) => r.ok).length
    const failed = rows.length - repaired
    return new Response(
      JSON.stringify({
        success: true,
        scanned: rows.length,
        repaired,
        failed,
        details: rows,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[reconcile] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
