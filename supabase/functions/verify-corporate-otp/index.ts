import { createServiceClient } from '../_shared/smtp.ts'
import { sendCorporateWelcomeEmail } from '../_shared/corporateWelcome.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SELF_SERVE_TIERS = ['bronze', 'silver', 'gold']

// 10-character password from an unambiguous alphabet.
function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { email, otp_code } = body

    if (!email || !otp_code) throw new Error('Email and verification code are required')

    const supabase = createServiceClient()

    // Find the most recent unused, unexpired code for this address
    const { data: signup, error: fetchError } = await supabase
      .from('corporate_signups')
      .select('*')
      .eq('email', String(email).toLowerCase())
      .eq('otp_code', String(otp_code))
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!signup) {
      throw new Error('Invalid or expired verification code. Please request a new one.')
    }

    // Mark the code as used (one-time)
    await supabase.from('corporate_signups').update({ used: true }).eq('id', signup.id)

    const data = signup.signup_data || {}
    const tier = data.tier
    const companyName = data.company_name
    if (!SELF_SERVE_TIERS.includes(tier) || !companyName) {
      throw new Error('This signup is no longer valid. Please start over.')
    }

    const tempPassword = generateTempPassword()

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email: data.email, password: tempPassword, email_confirm: true })
    if (authError) {
      if (authError.message?.includes('already')) throw new Error('An account with this email already exists. Please sign in instead.')
      throw authError
    }
    const userId = authData.user.id

    // 2. Create profile (role = corporate)
    const { error: rpcError } = await supabase.rpc('create_user_profile', {
      p_id: userId, p_full_name: data.contact_person || companyName, p_email: data.email, p_phone: data.contact_phone || '', p_role: 'corporate',
      p_location: '', p_county: '', p_subcounty: '', p_skills: '', p_resume: '', p_terms_accepted: true, p_data_sharing_consent: true,
    })
    if (rpcError) { console.error('Profile RPC error:', rpcError); throw new Error('Profile creation failed: ' + rpcError.message) }

    // 3. Create corporate account
    const { data: account, error: accountErr } = await supabase
      .from('corporate_accounts')
      .insert({
        company_name: companyName,
        tier,
        is_active: true,
        contact_person: data.contact_person || null,
        contact_phone: data.contact_phone || null,
        contact_email: data.contact_email || data.email,
        billing_email: data.billing_email || null,
      })
      .select('id')
      .single()
    if (accountErr) throw new Error('Account creation failed: ' + accountErr.message)

    // 4. Add owner member
    const { error: memberErr } = await supabase
      .from('corporate_members')
      .insert({ account_id: account.id, profile_id: userId, member_role: 'owner' })
    if (memberErr) throw new Error('Member creation failed: ' + memberErr.message)

    // 5. Welcome email with the temporary password (fire and forget)
    sendCorporateWelcomeEmail(supabase, data.email, companyName, tier, tempPassword).catch((err: any) => {
      console.error('Corporate welcome email failed:', err?.message || err)
    })

    return new Response(JSON.stringify({ success: true, account_id: account.id, temp_password: tempPassword }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})