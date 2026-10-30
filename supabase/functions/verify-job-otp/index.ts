import { createServiceClient } from '../_shared/smtp.ts'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'
import { requireUser } from '../_shared/requireUser.ts'
import { otpMatches } from '../_shared/otpHash.ts'

const MAX_ATTEMPTS = 5
const JOB_FIELDS = [
  'title', 'description', 'location', 'county', 'subcounty',
  'budget_min', 'budget_max', 'deadline', 'category', 'urgent',
  'images', 'posted_by', 'posted_by_name',
] as const

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

function sanitizeJobData(raw: any, userId: string) {
  const clean: Record<string, unknown> = {}
  for (const key of JOB_FIELDS) {
    if (raw && Object.prototype.hasOwnProperty.call(raw, key)) clean[key] = raw[key]
  }
  clean.posted_by = userId
  return clean
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!isOriginAllowed(req)) return json({ error: 'Origin not allowed' }, 403, corsHeaders)

  try {
    const user = await requireUser(req)
    if (!user) return json({ error: 'Sign in to verify your job post' }, 401, corsHeaders)

    const body = await req.json().catch(() => ({}))
    const code = String(body?.otp_code || '').trim()
    if (!/^\d{6}$/.test(code)) {
      return json({ error: 'Enter the six-digit code from your email' }, 400, corsHeaders)
    }

    const supabase = createServiceClient()

    // The code is bound to this account; another user's code never matches
    // because the query is scoped to the authenticated id.
    const { data: record, error: fetchError } = await supabase
      .from('job_otps')
      .select('id, otp_hash, job_data, attempts')
      .eq('user_id', user.id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) throw fetchError

    const invalid = () => json({ error: 'Invalid or expired verification code. Please request a new one.' }, 400, corsHeaders)

    if (!record) return invalid()

    if ((record.attempts || 0) >= MAX_ATTEMPTS) {
      await supabase.from('job_otps').update({ used: true }).eq('id', record.id)
      return invalid()
    }

    if (!(await otpMatches(user.id, code, record.otp_hash))) {
      const attempts = (record.attempts || 0) + 1
      await supabase
        .from('job_otps')
        .update({ attempts, used: attempts >= MAX_ATTEMPTS })
        .eq('id', record.id)
      return invalid()
    }

    const { error: updateError } = await supabase
      .from('job_otps')
      .update({ used: true })
      .eq('id', record.id)
      .eq('used', false)
    if (updateError) throw updateError

    return json({ valid: true, job_data: sanitizeJobData(record.job_data, user.id) }, 200, corsHeaders)
  } catch (err: any) {
    console.error('[verify-job-otp]', err?.message || err)
    return json({ error: 'Verification failed. Please try again.' }, 400, corsHeaders)
  }
})
