import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only a logged-in super_admin may delete users.
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: callerData, error: callerErr } = await caller.auth.getUser()
    if (callerErr || !callerData.user) {
      return new Response(JSON.stringify({ error: callerErr?.message || 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', callerData.user.id).single()
    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Admin privileges required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Delete the auth user first, then the profile, to avoid orphan auth records.
    // A missing auth user is not an error: the account may have been removed
    // from the Auth dashboard already, leaving only an orphaned profile row.
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id)
    const authMissing = authError && /not found|404|does not exist/i.test(authError.message || '')
    if (authError && !authMissing) throw authError

    // The profile may still be referenced by rows whose FK does not cascade on
    // delete (NO ACTION), which would block the delete. Detach them first.
    const detach = async (label: string, run: () => PromiseLike<{ error: { message?: string } | null }>) => {
      const { error } = await run()
      if (error) throw new Error(`${label}: ${error.message || 'failed'}`)
    }

    await detach('payments.related_profile_id', () => supabase.from('payments').update({ related_profile_id: null }).eq('related_profile_id', user_id))
    await detach('service_ads.owner_id', () => supabase.from('service_ads').update({ owner_id: null }).eq('owner_id', user_id))
    await detach('service_ratings.user_id', () => supabase.from('service_ratings').delete().eq('user_id', user_id))
    await detach('corporate_members.profile_id', () => supabase.from('corporate_members').delete().eq('profile_id', user_id))
    await detach('user_roles.id', () => supabase.from('user_roles').delete().eq('id', user_id))
    await detach('ratings.poster_id', () => supabase.from('ratings').delete().eq('poster_id', user_id))
    await detach('job_otps.user_id', () => supabase.from('job_otps').delete().eq('user_id', user_id))
    await detach('profiles.id', () => supabase.from('profiles').delete().eq('id', user_id))

    return new Response(
      JSON.stringify({ success: true, auth_deleted: !authMissing }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
