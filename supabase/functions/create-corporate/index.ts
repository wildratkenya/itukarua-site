import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendCorporateWelcomeEmail } from '../_shared/corporateWelcome.ts'

const ALLOW_ORIGINS = ['https://www.itukarua.co.ke', 'https://itukarua3.vercel.app', 'http://localhost:8080']

const ALLOWED_FEATURES = [
  'slot_sitewide_strip', 'slot_category_strip', 'slot_homepage_banner', 'slot_job_listings_top',
  'featured', 'full_analytics', 'multi_images',
]

function cleanFeatureIds(list: unknown): Set<string> {
  const ids = Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  const out = new Set<string>()
  for (const id of ids) if (ALLOWED_FEATURES.includes(id)) out.add(id)
  return out
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' ? Math.round(v) : typeof v === 'string' ? Math.round(Number(v)) : Number.NaN
  if (Number.isNaN(n)) return 1
  return Math.min(max, Math.max(min, n))
}

async function sendWelcomeEmail(supabase: any, email: string, company: string, tier: string, tempPassword: string) {
  try { await sendCorporateWelcomeEmail(supabase, email, company, tier, tempPassword) } catch (err) { console.error('Corporate welcome email failed:', (err as Error).message) }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOW_ORIGINS.includes(origin || '') ? origin : ALLOW_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!supabaseServiceKey) return new Response(JSON.stringify({ error: 'Service role key not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Only a logged-in super_admin may create corporate accounts.
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

    const { email, password, company_name, tier, contact_person, contact_phone, contact_email, billing_email, notes } = await req.json()

    if (!email || !password || !company_name || !tier) {
      return new Response(JSON.stringify({ error: 'email, password, company_name and tier are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!['bronze','silver','gold','custom'].includes(tier)) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Custom bundles: validate the ticked feature ids against the catalog.
    const reqBody = await req.json()
    const features = Array.isArray(reqBody.features) ? reqBody.features : null
    const cleanFeatures = features === null ? null : cleanFeatureIds(features)
    if (tier === 'custom' && cleanFeatures !== null && cleanFeatures.size === 0) {
      return new Response(JSON.stringify({ error: 'Custom bundles must include at least one feature' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const placements = clampInt(reqBody.placements, 1, 99)
    const teamSeats = clampInt(reqBody.team_seats, 1, 99)
    const savedFeatures = tier === 'custom' && cleanFeatures !== null
      ? { ids: [...cleanFeatures], placements, team_seats: teamSeats }
      : null

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
    if (authError) {
      if (authError.message.includes('already')) return new Response(JSON.stringify({ error: 'A user with this email already exists' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      throw authError
    }
    const userId = authData.user.id

    // 2. Create profile (role = corporate)
    const { error: rpcError } = await supabase.rpc('create_user_profile', {
      p_id: userId, p_full_name: contact_person || company_name, p_email: email, p_phone: contact_phone || '', p_role: 'corporate',
      p_location: '', p_county: '', p_subcounty: '', p_skills: '', p_resume: '', p_terms_accepted: true, p_data_sharing_consent: true,
    })
    if (rpcError) { console.error('Profile RPC error:', rpcError); throw new Error('Profile creation failed: ' + rpcError.message) }

    // 3. Create corporate account
    const { data: account, error: accountErr } = await supabase
      .from('corporate_accounts')
      .insert({ company_name, tier, is_active: true, features: savedFeatures, contact_person: contact_person || null, contact_phone: contact_phone || null, contact_email: contact_email || email, billing_email: billing_email || null, notes: notes || null })
      .select('id')
      .single()
    if (accountErr) throw new Error('Account creation failed: ' + accountErr.message)

    // 4. Add owner member
    const { error: memberErr } = await supabase
      .from('corporate_members')
      .insert({ account_id: account.id, profile_id: userId, member_role: 'owner' })
    if (memberErr) throw new Error('Member creation failed: ' + memberErr.message)

    // 5. Send welcome email (fire and forget)
    sendWelcomeEmail(supabase, email, company_name, tier, password).catch(() => {})

    return new Response(JSON.stringify({ success: true, user_id: userId, account_id: account.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
