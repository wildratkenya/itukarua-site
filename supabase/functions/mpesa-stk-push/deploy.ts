import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const SITE_URL = Deno.env.get('SITE_URL') || 'https://www.itukarua.co.ke'

function createFreshTransport(cfg: { host: string; port: number; secure: boolean; user: string; pass: string; from: string }) {
  return nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } })
}

async function loadSmtpConfig(supabase?: any) {
  const host = Deno.env.get('SMTP_HOST')
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASS')
  const port = parseInt(Deno.env.get('SMTP_PORT') || '465')
  const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Itukarua'
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || user || 'noreply@itukarua.co.ke'
  if (host && user && pass) return { host, port, secure: port === 465, user, pass, from: `${fromName} <${fromEmail}>` }
  if (supabase) {
    const { data: providers } = await supabase.from('email_providers').select('*').eq('is_active', true).limit(1)
    const active = Array.isArray(providers) && providers.length > 0 ? providers[0] : null
    if (active?.smtp_host && active?.username && active?.password) {
      const dbPort = active.smtp_port || 465
      return { host: active.smtp_host, port: dbPort, secure: dbPort === 465, user: active.username, pass: active.password, from: `${active.from_name || 'Itukarua'} <${active.from_email || active.username}>` }
    }
  }
  throw new Error('SMTP not configured.')
}

function escapeHtml(s: any): string { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

const ALLOWED_ORIGINS = ['https://www.itukarua.co.ke', 'https://itukarua3.vercel.app', 'http://localhost:8080']

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  registration: 'Account Registration',
  contact_access: 'Contact Access',
  job_posting: 'Job Posting',
  job_payment: 'Job Payment',
  advert: 'Advertisement',
  featured_boost: 'Featured Boost',
  single_job_post: 'Single Job Access',
  employer_day_token: 'Employer Day Token',
}

async function sendPaymentReceipt(supabase: any, payment: any, mpesaRef: string) {
  try {
    if (!payment?.user_id) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', payment.user_id)
      .maybeSingle()
    const recipient = profile?.email
    if (!recipient) return

    const label = PAYMENT_TYPE_LABELS[payment.payment_type] || 'Payment'
    const amount = Number(payment.amount || 0).toLocaleString()
    const ref = mpesaRef || payment.mpesa_ref || 'Pending'
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff">
  <tr><td style="background:linear-gradient(135deg,#059669,#047857);padding:24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">Payment Received ✅</h1>
    <p style="color:#d1fae5;font-size:13px;margin:6px 0 0">${dateStr}</p>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 4px;color:#374151;font-size:14px">Hello ${escapeHtml(profile?.full_name || 'there')},</p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px">Thank you! Your payment for <strong>${escapeHtml(label)}</strong> has been received successfully.</p>
    <table style="width:100%;border:1px solid #e5e7eb;border-radius:10px;border-collapse:collapse">
      <tr><td style="padding:12px;background:#f9fafb;font-weight:600;width:45%">Amount Paid</td><td style="padding:12px">KES ${amount}</td></tr>
      <tr><td style="padding:12px;background:#f9fafb;font-weight:600">Payment Type</td><td style="padding:12px">${escapeHtml(label)}</td></tr>
      <tr><td style="padding:12px;background:#f9fafb;font-weight:600">M-Pesa Reference</td><td style="padding:12px">${escapeHtml(ref)}</td></tr>
      <tr><td style="padding:12px;background:#f9fafb;font-weight:600">Account Reference</td><td style="padding:12px">${escapeHtml(payment.description || payment.checkout_request_id || 'ITUKARUA')}</td></tr>
    </table>
    <a href="${SITE_URL}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Continue on Itukarua →</a>
  </td></tr>
  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#9ca3af;font-size:11px;margin:0">This is a receipt for a payment made on <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua Classifieds</a>.</p>
  </td></tr>
</table>
</body>
</html>`

    const smtp = await loadSmtpConfig(supabase)
    const transport = createFreshTransport(smtp)
    await transport.sendMail({
      from: smtp.from,
      to: recipient,
      subject: `Itukarua — Payment Received: ${label}`,
      text: `Hello, thank you! Your payment for ${label} (KES ${amount}, Ref ${ref}) has been received.`,
      html,
    })
  } catch (err) {
    console.error('[STK Push] Receipt email failed:', err.message)
  }
}

const CONSUMER_KEY = Deno.env.get('MPESA_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET')!
const PASSKEY = Deno.env.get('MPESA_PASSKEY') || ''
const SHORTCODE = Deno.env.get('MPESA_SHORTCODE') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SIMULATE = Deno.env.get('MPESA_SIMULATE') === 'true'

const DARAJA_BASE = Deno.env.get('MPESA_BASE_URL') || 'https://sandbox.safaricom.co.ke'

function getTimestamp(): string {
  const now = new Date()
  const y = now.getFullYear().toString()
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  const d = now.getDate().toString().padStart(2, '0')
  const h = now.getHours().toString().padStart(2, '0')
  const min = now.getMinutes().toString().padStart(2, '0')
  const s = now.getSeconds().toString().padStart(2, '0')
  return `${y}${m}${d}${h}${min}${s}`
}

function formatPhone(phone: string): string {
  let p = phone.replace(/[^0-9]/g, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (p.startsWith('+')) p = p.slice(1)
  if (!p.startsWith('254')) p = '254' + p
  return p
}

async function getOAuthToken(): Promise<string> {
  const auth = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
  const url = `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`
  console.log('[OAuth] Fetching token from:', url)
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, 'User-Agent': 'Itukarua/1.0' },
  })
  const raw = await res.text()
  console.log('[OAuth] Raw response:', raw)
  const data = JSON.parse(raw)
  if (!data.access_token) throw new Error('OAuth failed: ' + JSON.stringify(data))
  const token = data.access_token.trim()
  console.log('[OAuth] Token obtained, length:', token.length)
  return token
}

async function applySubscriptionExtension(supabase: any, payment: any) {
  const { data: profile } = await supabase.from('profiles').select('subscription_expires_at').eq('id', payment.user_id).maybeSingle()
  const base = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : new Date()
  if (base.getTime() < Date.now()) base.setTime(Date.now())
  // Employer weekly ("Employer Weekly Access" / EMP-WK) = 7 days; all other
  // registration-type payments (jobseeker premium, etc.) = 30 days.
  const days = payment.description?.includes('Employer Weekly') ? 7 : 30
  base.setDate(base.getDate() + days)
  await supabase.from('profiles').update({
    subscription_expires_at: base.toISOString(),
    registration_paid: true,
  }).eq('id', payment.user_id)
}

async function completePayment(supabase: any, payment: any) {
  const mpesaRef = `MPE${Date.now().toString().slice(-8)}`
  await supabase.from('payments').update({
    status: 'completed',
    mpesa_ref: mpesaRef,
  }).eq('id', payment.id)

  if (payment.payment_type === 'registration') {
    await applySubscriptionExtension(supabase, payment)
  } else if (payment.payment_type === 'advert' && payment.related_ad_id) {
    await supabase.from('service_ads').update({ payment_confirmed: true }).eq('id', payment.related_ad_id)
  }

  await sendPaymentReceipt(supabase, payment, mpesaRef)
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/mpesa-stk-push/, '') || '/'
  const corsHeaders = corsHeadersFor(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ─── Initiate STK Push ──────────────────────────────────────────
    if (req.method === 'POST' && (path === '/' || path === '')) {
      const { phone, amount, accountRef, description, user_id, payment_type, related_job_id, related_ad_id, related_profile_id, token } = await req.json()

      if (!phone || !amount) {
        return new Response(
          JSON.stringify({ error: 'Phone and amount required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const formattedPhone = formatPhone(phone)
      const checkoutId = `WS${Date.now()}`
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

      // Create pending payment record
      const { data: paymentData, error: insertErr } = await supabase.from('payments').insert({
        user_id,
        payment_type: payment_type || 'registration',
        amount: Math.round(amount),
        mpesa_phone: formattedPhone,
        status: 'pending',
        description: description || accountRef || 'Payment',
        checkout_request_id: checkoutId,
        related_job_id: related_job_id || null,
        related_ad_id: related_ad_id || null,
        related_profile_id: related_profile_id || null,
        token: token || null,
      }).select('id').single()

      if (insertErr) {
        console.error('[STK Push] DB insert error:', insertErr)
        return new Response(
          JSON.stringify({ error: 'Failed to create payment record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (SIMULATE) {
        console.log('[STK Push] Simulation mode — payment will auto-complete on first status poll after 15s')
      } else {
        // Real Daraja integration
        try {
          const timestamp = getTimestamp()
          const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`)
          const token = await getOAuthToken()

          const stkRes = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Itukarua/1.0',
            },
            body: JSON.stringify({
              BusinessShortCode: SHORTCODE,
              Password: password,
              Timestamp: timestamp,
              TransactionType: Deno.env.get('MPESA_TXN_TYPE') || 'CustomerBuyGoodsOnline',
              Amount: Math.round(amount),
              PartyA: formattedPhone,
              PartyB: SHORTCODE,
              PhoneNumber: formattedPhone,
              CallBackURL: Deno.env.get('MPESA_CALLBACK_URL') || `${SUPABASE_URL}/functions/v1/mpesa-stk-push/callback`,
              AccountReference: accountRef || 'ITUKARUA',
              TransactionDesc: description || 'Payment',
            }),
          })

          const stkData = JSON.parse(await stkRes.text())
          const darajaCode = stkData.ResponseCode ?? stkData.responseCode
          const darajaDesc = stkData.ResponseDescription ?? stkData.responseDesc

          if (darajaCode !== '0' && darajaCode !== 0) {
            console.error('[STK Push] Daraja error code:', darajaCode, 'desc:', darajaDesc)
            return new Response(
              JSON.stringify({ error: `Daraja: ${darajaDesc}`, daraja: stkData }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Update checkout_request_id with real Daraja ID
          await supabase.from('payments').update({
            checkout_request_id: stkData.CheckoutRequestID,
          }).eq('id', paymentData?.id)
        } catch (err) {
          console.error('[STK Push] Daraja call failed:', err.message)
          return new Response(
            JSON.stringify({ error: 'Payment service unavailable. Please try again.' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          CheckoutRequestID: checkoutId,
          payment_id: paymentData?.id,
          simulated: SIMULATE,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── Handle Safaricom Callback ─────────────────────────────────
    if (req.method === 'POST' && path === '/callback') {
      const callbackData = await req.json()
      const safeCallback = { ...callbackData, Body: { ...callbackData.Body, stkCallback: { ResultCode: callbackData.Body?.stkCallback?.ResultCode, CheckoutRequestID: callbackData.Body?.stkCallback?.CheckoutRequestID } } }
      console.log('[STK Callback] ResultCode:', safeCallback.Body?.stkCallback?.ResultCode, 'CheckoutRequestID:', safeCallback.Body?.stkCallback?.CheckoutRequestID)

      const { Body } = callbackData
      if (!Body?.stkCallback) {
        return new Response(
          JSON.stringify({ error: 'Invalid callback data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

      let mpesaRef = ''
      if (CallbackMetadata?.Item) {
        for (const item of CallbackMetadata.Item) {
          if (item.Name === 'MpesaReceiptNumber') mpesaRef = item.Value
        }
      }

      const newStatus = ResultCode === 0 ? 'completed' : 'failed'
      const updates: any = { status: newStatus }
      if (mpesaRef) updates.mpesa_ref = mpesaRef
      if (newStatus === 'failed') updates.mpesa_ref = ResultDesc

      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('checkout_request_id', CheckoutRequestID)
        .maybeSingle()

      if (payment) {
        await supabase.from('payments').update(updates).eq('id', payment.id)

        if (newStatus === 'completed') {
          if (payment.payment_type === 'registration') {
            await applySubscriptionExtension(supabase, payment)
          } else if (payment.payment_type === 'advert' && payment.related_ad_id) {
            await supabase.from('service_ads').update({ payment_confirmed: true }).eq('id', payment.related_ad_id)
          }

          await sendPaymentReceipt(supabase, payment, mpesaRef)
        }
      }

      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── Query STK Push Status ─────────────────────────────────────
    if (req.method === 'GET' && path === '/status') {
      const checkoutRequestId = url.searchParams.get('CheckoutRequestID')
      if (!checkoutRequestId) {
        return new Response(
          JSON.stringify({ error: 'CheckoutRequestID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('checkout_request_id', checkoutRequestId)
        .maybeSingle()

      if (!payment) {
        return new Response(
          JSON.stringify({ success: true, resultCode: 1, resultDesc: 'Payment not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // In simulation mode, auto-complete pending payments after 15 seconds
      if (SIMULATE && payment.status === 'pending') {
        const createdAt = new Date(payment.created_at).getTime()
        const elapsed = Date.now() - createdAt
        if (elapsed >= 15000 || isNaN(createdAt)) {
          await completePayment(supabase, payment)
          payment.status = 'completed'
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: payment.status,
          payment,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[STK Push] Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
