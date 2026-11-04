import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!isOriginAllowed(req)) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    const url = Deno.env.get('SUPABASE_URL')!
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const callerClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: callerData } = await callerClient.auth.getUser()
    if (!token || !callerData.user) throw new Error('Unauthorized')
    const { account_id, email } = await req.json()
    if (!account_id || !email?.trim()) throw new Error('Account and new email are required')
    const { data: callerProfile } = await service.from('profiles').select('role').eq('id', callerData.user.id).maybeSingle()
    if (callerProfile?.role !== 'super_admin') throw new Error('Only an administrator can change the owner login email')
    const { data: owner } = await service.from('corporate_members').select('profile_id').eq('account_id', account_id).eq('member_role', 'owner').single()
    if (!owner) throw new Error('Corporate owner not found')
    const { error } = await service.auth.admin.updateUserById(owner.profile_id, { email: email.trim(), email_confirm: false })
    if (error) throw error
    const { error: profileError } = await service.from('profiles').update({ email: email.trim() }).eq('id', owner.profile_id)
    if (profileError) throw profileError
    return new Response(JSON.stringify({ ok: true, confirmation_required: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Owner email change failed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
