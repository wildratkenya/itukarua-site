import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'
import { requireUser } from '../_shared/requireUser.ts'

// Kenya DPA s.26 / GDPR Art.15: a member can obtain a copy of their own data.
// Every query is scoped to the verified caller id.
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

    const uid = user.id
    const results = await Promise.all([
      admin.from('profiles').select('*').eq('id', uid).maybeSingle(),
      admin.from('jobs').select('*').eq('posted_by', uid),
      admin.from('bids').select('*').eq('bidder_id', uid),
      admin.from('payments').select('*').eq('user_id', uid),
      admin.from('messages').select('*').eq('sender_id', uid),
      admin.from('direct_messages').select('*').eq('sender_id', uid),
      admin.from('notifications').select('*').eq('user_id', uid),
      admin.from('profile_reviews').select('*').or(`reviewer_id.eq.${uid},profile_id.eq.${uid}`),
      admin.from('service_ratings').select('*').eq('user_id', uid),
      admin.from('service_ads').select('*').eq('owner_id', uid),
      admin.from('advertisements').select('*').eq('owner_id', uid),
      admin.from('corporate_members').select('*').eq('profile_id', uid),
      admin.from('profile_roles').select('*').eq('user_id', uid),
      admin.from('newsletter_subscribers').select('*').ilike('email', user.email),
    ])

    const labels = [
      'profile', 'jobs_posted', 'bids', 'payments', 'messages_sent', 'direct_messages_sent',
      'notifications', 'profile_reviews', 'service_ratings', 'service_ads', 'advertisements',
      'corporate_memberships', 'entitlements', 'newsletter_subscription',
    ]

    const payload: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      account: { id: uid, email: user.email },
      notice: 'Payments are retained for five years under the Tax Procedures Act, 2015. Documents marked as certificates are in the private documents bucket.',
    }
    labels.forEach((label, index) => {
      payload[label] = results[index].data ?? []
    })

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="itukarua-data-${uid.slice(0, 8)}.json"`,
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
