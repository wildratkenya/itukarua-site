import { createServiceClient, loadSmtpConfig, createFreshTransport, escapeHtml, SITE_URL } from '../_shared/smtp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { user_id, email, job_data } = body

    if (!user_id || !email || !job_data) {
      throw new Error('user_id, email, and job_data are required')
    }

    const supabase = createServiceClient()

    // Rate limit: max 3 OTPs per user per 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('job_otps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', fifteenMinAgo)

    if (count && count >= 3) {
      throw new Error('Too many OTP requests. Please wait a few minutes and try again.')
    }

    // Invalidate any unused OTPs for this user
    await supabase
      .from('job_otps')
      .update({ used: true })
      .eq('user_id', user_id)
      .eq('used', false)

    // Generate 6-digit OTP
    const otp_code = String(Math.floor(100000 + Math.random() * 900000))
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    // Store OTP with job data
    const { error: insertError } = await supabase.from('job_otps').insert({
      user_id,
      email,
      otp_code,
      job_data,
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
  <tr><td style="background:#059669;padding:24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">Itukarua — Job Posting Verification</h1>
    <p style="color:#d1fae5;font-size:12px;margin:6px 0 0">Confirm your job post</p>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">Use the following verification code to post your job:</p>
    <div style="background:#f3f4f6;border-radius:12px;padding:20px;margin:16px 0">
      <p style="font-size:32px;font-weight:700;color:#059669;letter-spacing:8px;margin:0">${otp_code}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 0">This code expires in <strong>10 minutes</strong>.</p>
    <p style="color:#9ca3af;font-size:12px;margin:8px 0 0">If you didn't request this, you can safely ignore this email.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent by Itukarua Classifieds · <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua</a></p>
  </td></tr>
</table>
</body>
</html>`

    const text = `Itukarua — Job Posting Verification

Your verification code: ${otp_code}

This code expires in 10 minutes.
If you didn't request this, you can safely ignore this email.

— Itukarua Classifieds`

    await transport.sendMail({
      from: smtp.from,
      to: email,
      subject: 'Itukarua — Your Job Posting Verification Code',
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
