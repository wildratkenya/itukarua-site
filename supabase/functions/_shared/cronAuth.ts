// Fail-closed authentication for scheduled / cron edge functions.
//
// Three accepted identities:
//   1. The service-role key, sent as `Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`
//      by the GitHub cron workflows.
//   2. `x-cron-secret` matching the CRON_SECRET env var, sent by cron-job.org and similar.
//   3. A logged-in super_admin's JWT bearer token, used for manual admin triggers.
//
// Unlike the ad-hoc checks it replaces, this function NEVER falls open when the
// CRON_SECRET or service-role env var is missing. The caller must present a
// credential regardless, otherwise the function refuses to run.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

async function isSuperAdmin(token: string): Promise<boolean> {
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user } } = await client.auth.getUser()
    if (!user) return false
    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle()
    return profile?.role === 'super_admin'
  } catch {
    return false
  }
}

export type CronIdentity = 'service_role' | 'cron_secret' | 'super_admin'

/** Returns the matched identity or null when the caller is unauthenticated. */
export async function authenticateCron(req: Request): Promise<CronIdentity | null> {
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()

  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (bearer && serviceRole && bearer === serviceRole) return 'service_role'

  const secret = Deno.env.get('CRON_SECRET') || ''
  const provided = (req.headers.get('x-cron-secret') || '').trim()
  if (provided && secret && provided === secret) return 'cron_secret'

  if (bearer && (await isSuperAdmin(bearer))) return 'super_admin'

  return null
}