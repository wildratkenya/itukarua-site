import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createFreshTransport, loadSmtpConfig, escapeHtml, SITE_URL } from '../_shared/smtp.ts'

const ALLOW_ORIGIN = 'https://www.itukarua.co.ke'
const corsHeaders = { 'Access-Control-Allow-Origin': ALLOW_ORIGIN, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const TIER_LABELS: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', custom: 'Custom' }
const TIER_SLOTS: Record<string, string> = { bronze: 'Site-wide strip', silver: 'Jobs & Services strips', gold: 'Homepage carousel + strips', custom: 'Full custom bundle' }

async function sendWelcomeEmail(supabase: any, email: string, company: string, tier: string, tempPassword: string) {
  try {
    const tierLabel = TIER_LABELS[tier] || tier
    const slotInfo = TIER_SLOTS[tier] || 'Your placements'
    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff">
  <tr><td style="background:linear-gradient(135deg,#111827,#1f2937);padding:24px">
    <table cellpadding="0" cellspacing="0" style="width:100%"><tr>
      <td style="width:56px;vertical-align:middle"><img src="${SITE_URL}/images/logo.png" alt="" width="56" height="56" style="border-radius:12px;display:block" /></td>
      <td style="padding-left:16px;vertical-align:middle"><h1 style="color:#fbbf24;font-size:20px;margin:0;font-weight:700">Welcome to Itukarua Corporate</h1></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 4px;color:#374151;font-size:14px">Hello,</p>
    <p style="margin:0 0 12px;color:#374151;font-size:14px">Your corporate account has been created for <strong>${escapeHtml(company)}</strong> at the <strong>${tierLabel}</strong> tier.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:120px">Login email</td><td style="padding:8px 12px">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Password</td><td style="padding:8px 12px;font-family:monospace">${escapeHtml(tempPassword)}</td></tr>
      <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Placements</td><td style="padding:8px 12px">${slotInfo}</td></tr>
    </table>
    <a href="${SITE_URL}" style="display:inline-block;padding:10px 24px;background:#111827;color:#fbbf24;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Log in to your panel →</a>
    <p style="margin:12px 0 0;color:#9ca3af;font-size:12px">For security, please change this password after your first login.</p>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#9ca3af;font-size:11px;margin:0"><a href="${SITE_URL}" style="color:#111827;text-decoration:none">Itukarua Classifieds</a></p>
  </td></tr>
</table>
</body>
</html>`
    const smtp = await loadSmtpConfig(supabase)
    const transport = createFreshTransport(smtp)
    await transport.sendMail({ from: smtp.from, to: email, subject: `Welcome to Itukarua — ${company} (${tierLabel})`, text: `Your corporate account is ready. Email: ${email} / Password: ${tempPassword}. Visit ${SITE_URL} to log in.`, html })
  } catch (err) { console.error('Corporate welcome email failed:', err.message) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!supabaseServiceKey) return new Response(JSON.stringify({ error: 'Service role key not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { email, password, company_name, tier, contact_person, contact_phone, contact_email, billing_email, notes } = await req.json()

    if (!email || !password || !company_name || !tier) {
      return new Response(JSON.stringify({ error: 'email, password, company_name and tier are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!['bronze','silver','gold','custom'].includes(tier)) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

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
      p_location: '', p_skills: '', p_resume: '', p_terms_accepted: true, p_data_sharing_consent: true,
    })
    if (rpcError) { console.error('Profile RPC error:', rpcError); throw new Error('Profile creation failed: ' + rpcError.message) }

    // 3. Create corporate account
    const { data: account, error: accountErr } = await supabase
      .from('corporate_accounts')
      .insert({ company_name, tier, is_active: true, contact_person: contact_person || null, contact_phone: contact_phone || null, contact_email: contact_email || email, billing_email: billing_email || null, notes: notes || null })
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
