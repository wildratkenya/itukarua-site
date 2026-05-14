import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONSUMER_KEY = Deno.env.get('MPESA_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET')!
const PASSKEY = Deno.env.get('MPESA_PASSKEY') || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'
const SHORTCODE = Deno.env.get('MPESA_SHORTCODE') || '174379'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SIMULATE = Deno.env.get('MPESA_SIMULATE') === 'true'

const DARAJA_BASE = 'https://sandbox.safaricom.co.ke'

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
  const res = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}`, 'User-Agent': 'Itukarua/1.0' },
  })
  const raw = await res.text()
  const data = JSON.parse(raw)
  if (!data.access_token) throw new Error('OAuth failed: ' + JSON.stringify(data))
  return data.access_token.trim()
}

async function completePayment(supabase: any, payment: any) {
  await supabase.from('payments').update({
    status: 'completed',
    mpesa_ref: `MPE${Date.now().toString().slice(-8)}`,
  }).eq('id', payment.id)

  if (payment.payment_type === 'registration') {
    await supabase.from('profiles').update({ registration_paid: true }).eq('id', payment.user_id)
  } else if (payment.payment_type === 'advert' && payment.related_ad_id) {
    await supabase.from('service_ads').update({ payment_confirmed: true }).eq('id', payment.related_ad_id)
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/mpesa-stk-push/, '') || '/'

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ─── Initiate STK Push ──────────────────────────────────────────
    if (req.method === 'POST' && (path === '/' || path === '')) {
      const { phone, amount, accountRef, description, user_id, payment_type, related_job_id, related_ad_id, related_profile_id } = await req.json()

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
              TransactionType: 'CustomerPayBillOnline',
              Amount: Math.round(amount),
              PartyA: formattedPhone,
              PartyB: SHORTCODE,
              PhoneNumber: formattedPhone,
              CallBackURL: `${SUPABASE_URL}/functions/v1/mpesa-stk-push/callback`,
              AccountReference: accountRef || 'ITUKARUA',
              TransactionDesc: description || 'Payment',
            }),
          })

          const stkData = JSON.parse(await stkRes.text())
          const darajaCode = stkData.ResponseCode ?? stkData.responseCode
          const darajaDesc = stkData.ResponseDescription ?? stkData.responseDesc

          if (darajaCode !== '0' && darajaCode !== 0) {
            console.error('[STK Push] Daraja error:', JSON.stringify(stkData))
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
      console.log('[STK Callback] Received:', JSON.stringify(callbackData))

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
            await supabase.from('profiles').update({ registration_paid: true }).eq('id', payment.user_id)
          } else if (payment.payment_type === 'advert' && payment.related_ad_id) {
            await supabase.from('service_ads').update({ payment_confirmed: true }).eq('id', payment.related_ad_id)
          }
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
