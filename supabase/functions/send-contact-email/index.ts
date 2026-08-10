import { createServiceClient, loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from '../_shared/smtp.ts'

const ALLOW_ORIGIN = 'https://www.itukarua.co.ke'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { name, email, phone, subject, message } = await req.json()
    const eName = escapeHtml(name || '')
    const eEmail = escapeHtml(email || '')
    const ePhone = escapeHtml(phone || '')
    const eSubject = escapeHtml(subject || 'General Inquiry')
    const eMessage = escapeHtml(message || '')

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff">
  <tr><td style="background:#059669;padding:24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">New Contact Message</h1>
  </td></tr>
  <tr><td style="padding:24px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:100px">Name</td><td style="padding:8px 12px">${eName}</td></tr>
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Email</td><td style="padding:8px 12px">${eEmail}</td></tr>
      ${phone ? `<tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Phone</td><td style="padding:8px 12px">${ePhone}</td></tr>` : ''}
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Subject</td><td style="padding:8px 12px">${eSubject}</td></tr>
    </table>
    <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
      <p style="margin:0 0 8px;font-weight:600;color:#111827">Message:</p>
      <p style="margin:0;color:#374151;line-height:1.6;white-space:pre-wrap">${eMessage}</p>
    </div>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent from the Itukarua contact form. <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua Classifieds</a></p>
  </td></tr>
</table>
</body>
</html>`

    const supabase = createServiceClient()
    const smtp = await loadSmtpConfig(supabase)
    const transport = createFreshTransport(smtp)
    await transport.sendMail({
      from: smtp.from,
      to: 'info@itukarua.co.ke',
      replyTo: `${eName} <${eEmail}>`,
      subject: `Contact: ${eSubject} from ${eName}`,
      text: `Name: ${eName}\nEmail: ${eEmail}\nPhone: ${ePhone || 'N/A'}\nSubject: ${eSubject}\nMessage:\n${eMessage}`,
      html,
    })

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
