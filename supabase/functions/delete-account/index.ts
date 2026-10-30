import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'
import { requireUser } from '../_shared/requireUser.ts'
import { removeStorageObjects } from '../_shared/storageCleanup.ts'

// Kenya DPA s.40 / GDPR Art.17: the member erases their own account. PII is
// scrubbed here; payment rows survive under the Tax Procedures Act.
Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const user = await requireUser(req)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const { data: purge, error: purgeError } = await admin.rpc('purge_profile_data', { p_user_id: user.id })
    if (purgeError) throw purgeError

    const paths = Array.isArray((purge as { storage_paths?: unknown })?.storage_paths)
      ? ((purge as { storage_paths: string[] }).storage_paths)
      : []
    const failedRemovals = await removeStorageObjects(admin, paths)

    const { error: authError } = await admin.auth.admin.deleteUser(user.id)
    const authMissing = authError && /not found|404|does not exist/i.test(authError.message || '')
    if (authError && !authMissing) throw authError

    return new Response(
      JSON.stringify({ success: true, storage_failures: failedRemovals }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
