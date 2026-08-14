import { createServiceClient, loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from '../_shared/smtp.ts'

const ALLOW_ORIGIN = 'https://www.itukarua.co.ke'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { item_type, item_id, recipient_email, business_name, amount, billing_cycle, billing_end, note, html: providedHtml, text: providedText } = body

    if (!item_id) throw new Error('item_id is required')
    if (!recipient_email) throw new Error('recipient_email is required')

    const label = item_type === 'service_ad' ? 'Business Advert' : 'Banner Advert'
    const subject = providedHtml ? (body.subject || `Itukarua ${label} — Billing Alert & Invoice`) : `Itukarua ${label} — Billing Alert & Invoice`
    const dueLabel = billing_end
      ? new Date(billing_end).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—'
    const eBusiness = escapeHtml(business_name || 'Your advert')
    const eCycle = escapeHtml(billing_cycle || '')
    const eNote = escapeHtml(note || (billStatus(billing_end) === 'expired'
      ? 'Your advert has expired. Renew it now to keep it visible to customers.'
      : 'Your advert is due for renewal. Pay below to keep it running without interruption.'))
    const amt = Number(amount) || 0

    // If the caller supplied rendered html/text (from the admin preview), send
    // exactly what was previewed. Otherwise build the default invoice below.
    if (providedHtml) {
      const supabase = createServiceClient()
      const smtp = await loadSmtpConfig(supabase)
      const transport = createFreshTransport(smtp)
      await transport.sendMail({
        from: smtp.from,
        to: recipient_email,
        subject,
        text: providedText || 'See attached invoice details in the HTML version.',
        html: providedHtml,
      })

      await logAndStamp(supabase, item_type, item_id, business_name, recipient_email, subject, amt, billing_end)

      return new Response(JSON.stringify({ sent: true, to: recipient_email, previewed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb">
  <tr><td style="background:#059669;padding:24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">Itukarua Billing — ${label}</h1>
    <p style="color:#d1fae5;font-size:12px;margin:6px 0 0">Invoice & Renewal Notice</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Hi ${eBusiness},</p>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">${eNote}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600;width:160px">Advert</td><td style="padding:10px 12px">${eBusiness}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Billing Cycle</td><td style="padding:10px 12px">${eCycle || '7 days'}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Due Date</td><td style="padding:10px 12px">${dueLabel}</td></tr>
      <tr><td style="padding:10px 12px;background:#f3f4f6;font-weight:600">Amount Due</td><td style="padding:10px 12px;font-size:18px;font-weight:700;color:#059669">KES ${amt.toLocaleString()}</td></tr>
    </table>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="font-weight:700;color:#111827;margin:0 0 10px">How to Pay via M-Pesa</p>
      <ol style="margin:0;padding-left:20px;color:#374151;line-height:1.9;font-size:14px">
        <li>Go to <strong>M-Pesa</strong> on your phone</li>
        <li>Select <strong>Lipa na M-Pesa</strong></li>
        <li>Choose <strong>Buy Goods and Services</strong> (Till)</li>
        <li>Enter Till No: <strong>1600149</strong></li>
        <li>Amount: <strong>KES ${amt.toLocaleString()}</strong></li>
      </ol>
      <p style="color:#6b7280;font-size:12px;margin:10px 0 0">Once your payment is confirmed your advert continues without interruption.</p>
    </div>
    <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0">Questions? Reply to this email or contact us at <a href="${SITE_URL}/contact" style="color:#059669;text-decoration:none">Itukarua Contact</a>.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent by Itukarua Classifieds · <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua</a></p>
  </td></tr>
</table>
</body>
</html>`

    const text = `Itukarua ${label} — Invoice & Renewal Notice

Hi ${business_name || 'there'},

${eNote}

Advert: ${business_name || '—'}
Billing Cycle: ${billing_cycle || '7 days'}
Due Date: ${dueLabel}
Amount Due: KES ${(amt || 0).toLocaleString()}

How to Pay via M-Pesa:
1. Go to M-Pesa on your phone
2. Select Lipa na M-Pesa
3. Choose Buy Goods and Services (Till)
4. Enter Till No: 1600149
5. Amount: KES ${(amt || 0).toLocaleString()}

Questions? Contact us at ${SITE_URL}/contact
— Itukarua Classifieds`

    const supabase = createServiceClient()
    const smtp = await loadSmtpConfig(supabase)
    const transport = createFreshTransport(smtp)
    await transport.sendMail({
      from: smtp.from,
      to: recipient_email,
      subject,
      text,
      html,
    })

    await logAndStamp(supabase, item_type, item_id, business_name, recipient_email, subject, amt, billing_end)

    return new Response(JSON.stringify({ sent: true, to: recipient_email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function logAndStamp(supabase: any, item_type: string, item_id: string, business_name: string | undefined, recipient_email: string, subject: string, amt: number, billingEnd?: string) {
  await supabase.from('billing_notifications').insert({
    item_type: item_type === 'service_ad' ? 'service_ad' : 'advert',
    item_id,
    business_name: business_name || null,
    recipient_email,
    subject,
    amount: amt || null,
    due_date: billingEnd ? new Date(billingEnd).toISOString().slice(0, 10) : null,
    status: 'sent',
  })

  const table = item_type === 'service_ad' ? 'service_ads' : 'advertisements'
  await supabase.from(table).update({ last_invoice_at: new Date().toISOString() }).eq('id', item_id)
}

function billStatus(billingEnd?: string): 'expired' | 'due' | 'ok' {
  if (!billingEnd) return 'ok'
  const end = new Date(billingEnd).getTime()
  if (end < Date.now()) return 'expired'
  if (end - Date.now() <= 7 * 24 * 60 * 60 * 1000) return 'due'
  return 'ok'
}
