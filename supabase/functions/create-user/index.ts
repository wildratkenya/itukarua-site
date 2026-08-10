import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createFreshTransport, loadSmtpConfig, escapeHtml, SITE_URL } from '../_shared/smtp.ts'

const ALLOW_ORIGIN = 'https://www.itukarua.co.ke'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLE_LABELS: Record<string, string> = {
  employer: 'an Employer',
  jobseeker: 'a Job Seeker',
  worker: 'a Worker',
  advertiser: 'an Advertiser',
  admin: 'an Admin',
}

async function sendWelcomeEmail(supabase: any, email: string, fullName: string, role: string) {
  try {
    const roleLabel = ROLE_LABELS[role] || 'a member'
    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff">
  <tr><td style="background:linear-gradient(135deg,#059669,#047857);padding:24px">
    <table cellpadding="0" cellspacing="0" style="width:100%">
      <tr>
        <td style="width:56px;vertical-align:middle">
          <img src="${SITE_URL}/images/logo.png" alt="" width="56" height="56" style="border-radius:12px;display:block" />
        </td>
        <td style="padding-left:16px;vertical-align:middle">
          <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700">Welcome to Itukarua!</h1>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 4px;color:#374151;font-size:14px">Hello ${escapeHtml(fullName || 'there')},</p>
    <p style="margin:0 0 12px;color:#374151;font-size:14px">Your account has been created on Itukarua Classifieds as <strong>${roleLabel}</strong>.</p>
    <p style="margin:0 0 12px;color:#374151;font-size:14px">You can now post jobs, list your services, advertise your business, and connect with people around your area.</p>
    <a href="${SITE_URL}" style="display:inline-block;padding:10px 24px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Go to Itukarua →</a>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#9ca3af;font-size:11px;margin:0"><a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua Classifieds</a> — Jobs &amp; Services around you.</p>
  </td></tr>
</table>
</body>
</html>`

    const smtp = await loadSmtpConfig(supabase)
    const transport = createFreshTransport(smtp)
    await transport.sendMail({
      from: smtp.from,
      to: email,
      subject: 'Welcome to Itukarua',
      text: `Hello ${fullName || 'there'}, your Itukarua account is ready. Visit ${SITE_URL} to get started.`,
      html,
    })
  } catch (err) {
    console.error('Welcome email failed:', err.message)
  }
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
    const { email, password, full_name, phone, role, location, county, subcounty, skills, resume, profile_image, ratings_enabled, terms_accepted, data_sharing_consent } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let userId: string
    let isNewUser = false

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
      isNewUser = true
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
      p_county: county || null,
      p_subcounty: subcounty || null,
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

    if (isNewUser) {
      await sendWelcomeEmail(supabase, email, full_name || '', role || '')
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
