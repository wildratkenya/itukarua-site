import { createServiceClient, loadSmtpConfig, createFreshTransport, SITE_URL } from '../_shared/smtp.ts'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'
import { requireUser } from '../_shared/requireUser.ts'
import { hashOtp } from '../_shared/otpHash.ts'

const MAX_REQUESTS_PER_WINDOW = 3
const WINDOW_MINUTES = 15
const CODE_TTL_MINUTES = 10
const MAX_JOB_DATA_BYTES = 20_000

function randomCode(): string {
  // Rejection sampling keeps the six digits uniform. Math.random is not a
  // suitable source for a code that gates job publication.
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000
  const buf = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= limit)
  return String(value % 1_000_000).padStart(6, '0')
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!isOriginAllowed(req)) return json({ error: 'Origin not allowed' }, 403, corsHeaders)

  try {
    // Only a signed-in user may request a code, and the mail always goes to the
    // address on their own account.
    const user = await requireUser(req)
    if (!user) return json({ error: 'Sign in to verify your job post' }, 401, corsHeaders)

    const body = await req.json().catch(() => ({}))
    const jobData = body?.job_data
    if (!jobData || typeof jobData !== 'object' || Array.isArray(jobData)) {
      return json({ error: 'job_data is required' }, 400, corsHeaders)
    }
    if (JSON.stringify(jobData).length > MAX_JOB_DATA_BYTES) {
      return json({ error: 'Job details are too large' }, 400, corsHeaders)
    }
    if (typeof jobData.title !== 'string' || !jobData.title.trim()
      || typeof jobData.description !== 'string' || !jobData.description.trim()) {
      return json({ error: 'A title and description are required' }, 400, corsHeaders)
    }

    const supabase = createServiceClient()

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
    const { count, error: countError } = await supabase
      .from('job_otps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', windowStart)

    if (countError) throw countError
    if ((count || 0) >= MAX_REQUESTS_PER_WINDOW) {
      return json({ error: 'Too many verification codes requested. Please wait a few minutes and try again.' }, 429, corsHeaders)
    }

    // Supersede any earlier code for this account.
    await supabase
      .from('job_otps')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false)

    const otpCode = randomCode()
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString()
    const storedJobData = {
      ...jobData,
      posted_by: user.id,
      posted_by_name: user.fullName || jobData.posted_by_name,
    }

    const { error: insertError } = await supabase.from('job_otps').insert({
      user_id: user.id,
      email: user.email,
      otp_hash: await hashOtp(user.id, otpCode),
      job_data: storedJobData,
      expires_at: expiresAt,
      attempts: 0,
    })
    if (insertError) throw insertError

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
      <p style="font-size:32px;font-weight:700;color:#059669;letter-spacing:8px;margin:0">${otpCode}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 0">This code expires in <strong>${CODE_TTL_MINUTES} minutes</strong>.</p>
    <p style="color:#9ca3af;font-size:12px;margin:8px 0 0">If you didn't request this, you can safely ignore this email.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent by Itukarua Classifieds · <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua</a></p>
  </td></tr>
</table>
</body>
</html>`

    const text = `Itukarua — Job Posting Verification

Your verification code: ${otpCode}

This code expires in ${CODE_TTL_MINUTES} minutes.
If you didn't request this, you can safely ignore this email.

— Itukarua Classifieds`

    await transport.sendMail({
      from: smtp.from,
      to: user.email,
      subject: 'Itukarua — Your Job Posting Verification Code',
      text,
      html,
    })

    return json({ sent: true, expires_at: expiresAt }, 200, corsHeaders)
  } catch (err: any) {
    console.error('[send-job-otp]', err?.message || err)
    return json({ error: 'Could not send a verification code. Please try again.' }, 400, corsHeaders)
  }
})
