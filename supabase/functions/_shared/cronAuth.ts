// Fail-closed authentication for scheduled / admin-triggered edge functions.
//
// Accepted identities:
//   1. The service-role key, sent as `Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`
//      by the GitHub cron workflows — accepted when it matches the env var exactly.
//   2. Any valid service-role JWT, sent the same way. The project's own service
//      credential is the new-style secret key (sb_secret_...), which is not a
//      JWT and therefore cannot be compared as a string against the legacy
//      service-role JWT the workflows hold. The role is resolved through the
//      platform instead, so both key formats authenticate.
//   3. `x-cron-secret` matching the CRON_SECRET env var, sent by cron-job.org and similar.
//   4. A logged-in super_admin's JWT bearer token, used for manual admin triggers.
//
// Unlike the ad-hoc checks it replaces, this function NEVER falls open when the
// CRON_SECRET or service-role env var is missing. The caller must present a
// credential regardless, otherwise the function refuses to run.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

function bearerOf(req: Request): string {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
}

function serviceClientWith(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

/**
 * Ask the platform which role a bearer token carries.
 *
 * The project's service credential is the new-style secret key (sb_secret_...),
 * which is not a JWT and can never travel in an Authorization header, while the
 * cron workflows hold the legacy service-role JWT. Comparing the two as
 * strings rejects a genuine service caller, so the role is resolved the way
 * every other request resolves it: PostgREST verifies the token's signature
 * against the project and reports the role it carries. A forged, expired or
 * unsigned token never reaches the database at all.
 */
async function carriesServiceRole(token: string): Promise<boolean> {
  try {
    const client = serviceClientWith(token)
    const { data, error } = await client.rpc('current_jwt_role')
    if (error || data == null) return false
    return String(data) === 'service_role'
  } catch {
    return false
  }
}

/** True when the token belongs to a signed-in user whose profile has one of the roles. */
async function hasProfileRole(token: string, roles: string[]): Promise<boolean> {
  try {
    const client = serviceClientWith(token)
    const { data, error } = await client.auth.getUser(token)
    const user = (data as any)?.user
    if (error || !user) return false
    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = (profile as any)?.role
    return !!role && roles.includes(role)
  } catch {
    return false
  }
}

/**
 * True when the caller presented the project's service credential in the
 * `apikey` header.
 *
 * The gateway refuses a bearer token that is not a JWT before the request ever
 * reaches the function, so a secret key can only travel in this header. The
 * public anon/publishable key that the browser sends is a different value and
 * never matches.
 */
function presentedServiceKey(req: Request): boolean {
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!serviceRole) return false
  const apikey = (req.headers.get('apikey') || '').trim()
  return !!apikey && apikey === serviceRole
}

export type CronIdentity = 'service_role' | 'cron_secret' | 'super_admin'
export type StaffIdentity = 'service_role' | 'cron_secret' | 'staff'

/** Returns the matched identity or null when the caller is unauthenticated. */
export async function authenticateCron(req: Request): Promise<CronIdentity | null> {
  const bearer = bearerOf(req)

  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (bearer && serviceRole && bearer === serviceRole) return 'service_role'
  if (presentedServiceKey(req)) return 'service_role'

  const secret = Deno.env.get('CRON_SECRET') || ''
  const provided = (req.headers.get('x-cron-secret') || '').trim()
  if (provided && secret && provided === secret) return 'cron_secret'

  if (bearer && (await carriesServiceRole(bearer))) return 'service_role'

  if (bearer && (await hasProfileRole(bearer, ['super_admin']))) return 'super_admin'

  return null
}

/**
 * Same credentials as the cron path, but any signed-in staff member
 * (admin or super_admin) is accepted too — used by functions an administrator
 * triggers by hand from the dashboard.
 */
export async function authenticateStaff(req: Request): Promise<StaffIdentity | null> {
  const bearer = bearerOf(req)

  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (bearer && serviceRole && bearer === serviceRole) return 'service_role'
  if (presentedServiceKey(req)) return 'service_role'

  const secret = Deno.env.get('CRON_SECRET') || ''
  const provided = (req.headers.get('x-cron-secret') || '').trim()
  if (provided && secret && provided === secret) return 'cron_secret'

  if (bearer && (await carriesServiceRole(bearer))) return 'service_role'

  if (bearer && (await hasProfileRole(bearer, ['admin', 'super_admin']))) return 'staff'

  return null
}
