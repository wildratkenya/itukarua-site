import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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
    const { email, password, full_name, phone, role, location, skills, resume, profile_image, ratings_enabled, terms_accepted, data_sharing_consent } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let userId: string

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        const { data: userList } = await supabase.auth.admin.listUsers()
        const existing = userList?.users?.find(u => u.email === email)
        if (!existing) {
          return new Response(
            JSON.stringify({ error: 'Email already exists but user lookup failed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        userId = existing.id
      } else {
        throw authError
      }
    } else if (authData?.user) {
      userId = authData.user.id
    } else {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create/update profile via SECURITY DEFINER function (bypasses RLS)
    const { error: rpcError } = await supabase.rpc('create_user_profile', {
      p_id: userId,
      p_full_name: full_name || '',
      p_email: email,
      p_phone: phone || '',
      p_role: role || 'employer',
      p_location: location || '',
      p_skills: role === 'jobseeker' ? (skills || '') : '',
      p_resume: role === 'jobseeker' ? (resume || '') : '',
      p_profile_image: profile_image || null,
      p_ratings_enabled: ratings_enabled || null,
      p_terms_accepted: terms_accepted === true,
      p_data_sharing_consent: data_sharing_consent === true,
    })

    if (rpcError) {
      console.error('Profile RPC error:', rpcError)
      return new Response(
        JSON.stringify({ error: 'Profile creation failed: ' + rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
