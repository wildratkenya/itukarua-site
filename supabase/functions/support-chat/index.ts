import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const MAX_MESSAGE_LENGTH = 500
const MAX_HISTORY = 10
const CONFIDENT_SCORE = 0.45
const RATE_LIMIT = 30

type HistoryMessage = { role?: string; text?: string }

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function parseAudience(value: unknown): string {
  return ['jobseeker', 'employer', 'advertiser'].includes(String(value)) ? String(value) : 'all'
}

Deno.serve(async (req) => {
  const headers = corsHeadersFor(req)
  if (!isOriginAllowed(req)) return json({ error: 'Origin not allowed' }, 403, headers)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  let stage = 'parse'
  try {
    const body = await req.json()
    const message = String(body?.message ?? '').trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!message) return json({ error: 'A message is required' }, 400, headers)

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    let user: { id: string; email?: string } | null = null
    if (token) {
      const { data } = await supabase.auth.getUser(token)
      user = data.user ? { id: data.user.id, email: data.user.email } : null
    }

    const requesterKey = await hash(user?.id || req.headers.get('x-forwarded-for') || 'anonymous')
    const { count } = await supabase
      .from('support_log')
      .select('id', { count: 'exact', head: true })
      .eq('requester_key', requesterKey)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    if ((count || 0) >= RATE_LIMIT) {
      return json({ error: 'Too many support messages. Please try again later.' }, 429, headers)
    }

    stage = 'match'
    const { data: entries, error: matchError } = await supabase
      .from('support_playbook')
      .select('id, title, keywords, answer, action, escalate, audience')
    if (matchError) throw matchError
    const queryTerms = new Set(message.toLowerCase().split(/[^a-z0-9]+/).filter((term: string) => term.length > 2))
    const audience = parseAudience(body?.audience)
    const hits = (entries || [])
      .filter((entry) => audience === 'all' || entry.audience.includes(audience) || entry.audience.includes('all'))
      .map((entry) => {
        const searchable = `${entry.title} ${entry.keywords}`.toLowerCase()
        const score = [...queryTerms].reduce((total, term) => total + (searchable.includes(term) ? 1 : 0), 0) / Math.max(queryTerms.size, 1)
        return { ...entry, score }
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)

    const top = hits?.[0]
    const history = Array.isArray(body?.history)
      ? body.history.slice(-MAX_HISTORY).map((item: HistoryMessage) => ({
          role: String(item?.role || '').slice(0, 20),
          text: String(item?.text || '').slice(0, MAX_MESSAGE_LENGTH),
        }))
      : []
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null
    const { data: onlineAdmins } = await supabase
      .from('support_admin_presence')
      .select('user_id')
      .gte('last_seen', new Date(Date.now() - 90_000).toISOString())
    const adminOnline = (onlineAdmins || []).length > 0

    if (top && Number(top.score) >= CONFIDENT_SCORE && !top.escalate) {
      let text = top.answer
      stage = 'action'
      if (top.action === 'check_payment' && user) {
        const { data: payment } = await supabase
          .from('payments')
          .select('checkout_request_id, local_checkout_id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (payment?.checkout_request_id || payment?.local_checkout_id) {
          await supabase.functions.invoke('payments-reconcile', {
            body: { checkoutRequestId: payment.checkout_request_id || payment.local_checkout_id },
            headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          })
          text += '\n\nI just re-checked your latest payment. Refresh in a minute; if access is still missing after 15 minutes, contact support with the M-Pesa confirmation code.'
        }
      } else if (top.action === 'check_plan' && user) {
        const { data: plan } = await supabase
          .from('profile_roles')
          .select('role, paid, expires_at')
          .eq('user_id', user.id)
          .order('expires_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        if (plan?.expires_at) {
          text += `\n\nYour current ${plan.paid ? plan.role : 'free'} access expires on ${new Date(plan.expires_at).toLocaleDateString('en-KE')}.`
        } else if (plan) {
          text += '\n\nYour current access has no paid expiry date. Open the plan chooser in your Dashboard to renew or upgrade.'
        }
      }
      stage = 'answer-log'
      await supabase.from('support_log').insert({
        requester_key: requesterKey,
        q: message,
        matched_id: top.id,
        score: top.score,
        outcome: 'answered',
      })
      return json({ type: 'answer', text, ref: top.id, adminOnline }, 200, headers)
    }

    const priority = ['PAY-2', 'PAY-3', 'SAF-1', 'SAF-2'].includes(top?.id) ? 'P1' : top?.escalate ? 'P2' : 'P3'
    stage = 'ticket'
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user?.id || null,
        email: user?.email || null,
        category: top?.id || 'unmatched',
        priority,
        message,
        transcript: history,
        conversation_id: conversationId,
      })
      .select('id')
      .single()
    if (ticketError) throw ticketError

    if (conversationId) {
      const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user?.id || null,
        sender_name: user?.email || 'Chat User',
        sender_email: user?.email || 'chat@itukarua.co.ke',
        subject: 'Support Chat',
        message,
        type: 'chat_message',
        status: 'unread',
        role: 'user',
      })
      if (messageError) throw messageError
    }

    stage = 'notification'
    const notification = await supabase.functions.invoke('send-contact-email', {
      body: {
        name: user?.email || 'Chat visitor',
        email: user?.email || 'chat@itukarua.co.ke',
        subject: `[${priority}] Support ticket ${ticket.id}`,
        message,
      },
    })
    if (notification.error) {
      console.error('[support-chat] ticket notification failed', notification.error)
    }

    stage = 'escalation-log'
    await supabase.from('support_log').insert({
      requester_key: requesterKey,
      q: message,
      matched_id: top?.id || null,
      score: top?.score || null,
      outcome: 'escalated',
    })
    return json({
      type: 'escalated',
      ticketId: ticket.id,
      conversationId,
      adminOnline,
      text: `I have passed this to our team. Your ticket number is ${ticket.id.slice(0, 8)}.`,
    }, 200, headers)
  } catch (error) {
    console.error('[support-chat] request failed', stage, error)
    return json({ error: 'Support is temporarily unavailable. Please use the Contact page.' }, 500, headers)
  }
})
