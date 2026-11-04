import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!isOriginAllowed(req)) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (!token) throw new Error('Unauthorized')
    const url = Deno.env.get('SUPABASE_URL')!
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const callerClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: callerData } = await callerClient.auth.getUser()
    if (!callerData.user) throw new Error('Unauthorized')
    const { member_id, full_name, email, password } = await req.json()
    const { data: member } = await service.from('corporate_members').select('id, account_id, profile_id, member_role').eq('id', member_id).single()
    if (!member || member.member_role === 'owner') throw new Error('Only non-owner team members can be edited here')
    const { data: callerProfile } = await service.from('profiles').select('role').eq('id', callerData.user.id).maybeSingle()
    const { data: callerMember } = await service.from('corporate_members').select('account_id, member_role').eq('profile_id', callerData.user.id).maybeSingle()
    const allowed = callerProfile?.role === 'super_admin' || (callerMember?.account_id === member.account_id && callerMember?.member_role === 'owner')
    if (!allowed) throw new Error('Only an administrator or account owner may edit this member')
    const authUpdate: Record<string, unknown> = {}
    if (email?.trim()) { authUpdate.email = email.trim(); authUpdate.email_confirm = false }
    if (password) authUpdate.password = password
    if (Object.keys(authUpdate).length) {
      const { error } = await service.auth.admin.updateUserById(member.profile_id, authUpdate)
      if (error) throw error
    }
    const profilePatch: Record<string, string> = {}
    if (full_name !== undefined) profilePatch.full_name = full_name.trim()
    if (email?.trim()) profilePatch.email = email.trim()
    if (Object.keys(profilePatch).length) {
      const { error } = await service.from('profiles').update(profilePatch).eq('id', member.profile_id)
      if (error) throw error
    }
    return new Response(JSON.stringify({ ok: true, email_confirmation_required: !!email?.trim() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Member update failed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
