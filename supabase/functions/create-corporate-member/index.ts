import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createFreshTransport, loadSmtpConfig, escapeHtml, SITE_URL } from '../_shared/smtp.ts'

const ALLOW_ORIGINS = ['https://www.itukarua.co.ke', 'https://itukarua3.vercel.app', 'http://localhost:8080']

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

    const { email, password, full_name, account_id, added_by } = await req.json()

    if (!email || !password || !account_id) {
      return new Response(JSON.stringify({ error: 'email, password and account_id are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Only a super_admin or a corporate-account team member may add members.
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
    const isAdmin = !!callerProfile && callerProfile.role === 'super_admin'
    const { data: callerMember } = await supabase.from('corporate_members').select('account_id,member_role').eq('profile_id', callerData.user.id).maybeSingle()
    const isOwner = !!callerMember && callerMember.member_role === 'owner' && callerMember.account_id === account_id
    if (!isAdmin && !isOwner) {
      return new Response(JSON.stringify({ error: 'Admin privileges required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify the account exists
    const { data: account } = await supabase.from('corporate_accounts').select('id,company_name').eq('id', account_id).single()
    if (!account) return new Response(JSON.stringify({ error: 'Account not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
    if (authError) {
      if (authError.message.includes('already')) return new Response(JSON.stringify({ error: 'A user with this email already exists' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      throw authError
    }
    const userId = authData.user.id

    // Create profile
    const { error: rpcError } = await supabase.rpc('create_user_profile', {
      p_id: userId, p_full_name: full_name || email.split('@')[0], p_email: email, p_phone: '', p_role: 'corporate',
      p_location: '', p_county: '', p_subcounty: '', p_skills: '', p_resume: '', p_terms_accepted: true, p_data_sharing_consent: true,
    })
    if (rpcError) throw new Error('Profile creation failed: ' + rpcError.message)

    // Add as member
    const { error: memberErr } = await supabase
      .from('corporate_members')
      .insert({ account_id, profile_id: userId, member_role: 'member' })
    if (memberErr) throw new Error('Member creation failed: ' + memberErr.message)

    // Send welcome email
    try {
      const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff">
  <tr><td style="background:#111827;padding:24px;text-align:center">
    <h1 style="color:#fbbf24;font-size:20px;margin:0">Team Access — ${escapeHtml(account.company_name)}</h1>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 12px;color:#374151;font-size:14px">You've been added to the <strong>${escapeHtml(account.company_name)}</strong> corporate team on Itukarua.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:120px">Email</td><td style="padding:8px 12px">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Password</td><td style="padding:8px 12px;font-family:monospace">${escapeHtml(password)}</td></tr>
    </table>
    <a href="${SITE_URL}" style="display:inline-block;padding:10px 24px;background:#111827;color:#fbbf24;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Log in to your panel →</a>
    <p style="margin:12px 0 0;color:#9ca3af;font-size:12px">Change this password after your first login.</p>
  </td></tr>
</table>
</body>
</html>`
      const smtp = await loadSmtpConfig(supabase)
      const transport = createFreshTransport(smtp)
      await transport.sendMail({ from: smtp.from, to: email, subject: `Team access — ${account.company_name}`, text: `You have been added to the ${account.company_name} corporate team. Email: ${email} / Password: ${password}`, html })
    } catch (err) { console.error('Team invite email failed:', err.message) }

    return new Response(JSON.stringify({ success: true, user_id: userId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
