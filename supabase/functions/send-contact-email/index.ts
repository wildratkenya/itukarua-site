import nodemailer from 'npm:nodemailer@6.9.16'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createTransport() {
  return nodemailer.createTransport({
    host: Deno.env.get('ETHEREAL_HOST') || 'smtp.ethereal.email',
    port: parseInt(Deno.env.get('ETHEREAL_PORT') || '587'),
    secure: false,
    auth: {
      user: Deno.env.get('ETHEREAL_USER') || 'sn5lk4qnes6yyqyd@ethereal.email',
      pass: Deno.env.get('ETHEREAL_PASS') || 'BUPHgH7pTE4sp7BFT7',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { name, email, phone, subject, message } = await req.json()

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
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:100px">Name</td><td style="padding:8px 12px">${name}</td></tr>
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Email</td><td style="padding:8px 12px">${email}</td></tr>
      ${phone ? `<tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Phone</td><td style="padding:8px 12px">${phone}</td></tr>` : ''}
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Subject</td><td style="padding:8px 12px">${subject || 'General Inquiry'}</td></tr>
    </table>
    <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
      <p style="margin:0 0 8px;font-weight:600;color:#111827">Message:</p>
      <p style="margin:0;color:#374151;line-height:1.6;white-space:pre-wrap">${message}</p>
    </div>
  </td></tr>
</table>
</body>
</html>`

    const transport = createTransport()
    await transport.sendMail({
      from: 'Itukarua Contact <noreply@itukarua.ke>',
      to: 'info@itukarua.co.ke',
      subject: `Contact: ${subject || 'General Inquiry'} from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nSubject: ${subject || 'General Inquiry'}\nMessage:\n${message}`,
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
