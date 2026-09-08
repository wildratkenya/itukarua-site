import { createServiceClient, loadSmtpConfig, createFreshTransport, SITE_URL } from '../_shared/smtp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SELF_SERVE_TIERS = ['bronze', 'silver', 'gold']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { email, tier, company_name, contact_person, contact_phone, contact_email, billing_email } = body

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required')
    if (!tier || !SELF_SERVE_TIERS.includes(tier)) throw new Error('Self-service signup is available for Bronze, Silver and Gold tiers only. Custom bundles are quoted.')
    if (!company_name || !String(company_name).trim()) throw new Error('Company name is required')

    const supabase = createServiceClient()

    // Reject if an auth user already exists for this email.
    const { data: existing } = await supabase.auth.admin.getUserByEmail(email)
    if (existing?.user) {
      throw new Error('An account already exists for this email. Please sign in instead.')
    }

    // Rate limit: max 3 OTPs per address per 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('corporate_signups')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .gte('created_at', fifteenMinAgo)

    if (count && count >= 3) {
      throw new Error('Too many verification requests. Please wait a few minutes and try again.')
    }

    // Invalidate any unused OTPs for this address
    await supabase
      .from('corporate_signups')
      .update({ used: true })
      .eq('email', email.toLowerCase())
      .eq('used', false)

    // Generate 6-digit OTP
    const otp_code = String(Math.floor(100000 + Math.random() * 900000))
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Store signup payload with the code
    const { error: insertError } = await supabase.from('corporate_signups').insert({
      email: email.toLowerCase(),
      otp_code,
      signup_data: {
        email: email.toLowerCase(),
        tier,
        company_name: String(company_name).trim(),
        contact_person: contact_person ? String(contact_person).trim() : null,
        contact_phone: contact_phone ? String(contact_phone).trim() : null,
        contact_email: contact_email ? String(contact_email).trim() : null,
        billing_email: billing_email ? String(billing_email).trim() : null,
      },
      expires_at,
    })
    if (insertError) throw insertError

    // Send OTP email
    const smtp = await loadSmtpConfig(supabase)
    const transport = createFreshTransport(smtp)

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb">
  <tr><td style="background:linear-gradient(135deg,#111827,#1f2937);padding:24px;text-align:center">
    <h1 style="color:#fbbf24;font-size:20px;margin:0">Itukarua Corporate — Verify Your Email</h1>
    <p style="color:#d1fae5;font-size:12px;margin:6px 0 0">Finish setting up your corporate account</p>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Use the following verification code to activate your <strong>${tier}</strong> tier account:</p>
    <div style="background:#f3f4f6;border-radius:12px;padding:20px;margin:16px 0">
      <p style="font-size:32px;font-weight:700;color:#111827;letter-spacing:8px;margin:0">${otp_code}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 0">This code expires in <strong>10 minutes</strong>.</p>
    <p style="color:#9ca3af;font-size:12px;margin:8px 0 0">If you didn't request this, you can safely ignore this email.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Itukarua Classifieds · <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua</a></p>
  </td></tr>
</table>
</body>
</html>`

    const text = `Itukarua Corporate — Verify Your Email

Your verification code: ${otp_code}

This code expires in 10 minutes.
If you didn't request this, you can safely ignore this email.

— Itukarua Classifieds`

    await transport.sendMail({
      from: smtp.from,
      to: email,
      subject: 'Itukarua — Your Corporate Signup Verification Code',
      text,
      html,
    })

    return new Response(JSON.stringify({ sent: true, expires_at }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})