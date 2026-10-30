import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'
import { removeStorageObjects } from '../_shared/storageCleanup.ts'

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

    // Same erasure routine the member-facing endpoint uses: personal rows are
    // removed, the profile is pseudonymised (payments must survive for tax), and
    // stored files are deleted before the auth identity is destroyed.
    const { data: purge, error: purgeError } = await supabase.rpc('purge_profile_data', { p_user_id: user_id })
    if (purgeError) throw purgeError

    const paths = Array.isArray((purge as { storage_paths?: unknown })?.storage_paths)
      ? ((purge as { storage_paths: string[] }).storage_paths)
      : []
    const storageFailures = await removeStorageObjects(supabase, paths)

    const { error: authError } = await supabase.auth.admin.deleteUser(user_id)
    const authMissing = authError && /not found|404|does not exist/i.test(authError.message || '')
    if (authError && !authMissing) throw authError

    return new Response(
      JSON.stringify({ success: true, auth_deleted: !authMissing, storage_failures: storageFailures }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
