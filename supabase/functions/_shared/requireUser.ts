// Resolve the caller from their JWT instead of trusting the request body.
//
// Used by endpoints that act on a user's own data (job OTPs). The browser sends
// the session token the app already stores; the platform verifies its signature
// in auth.getUser before we act.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuthedUser {
  id: string
  email: string
  fullName: string
}

export async function requireUser(req: Request): Promise<AuthedUser | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  try {
    const { data, error } = await client.auth.getUser(token)
    const user = data?.user
    if (error || !user?.email) return null
    const meta = (user.user_metadata || {}) as Record<string, unknown>
    const fullName = typeof meta.full_name === 'string' ? meta.full_name : ''
    return { id: user.id, email: user.email, fullName }
  } catch {
    return null
  }
}
