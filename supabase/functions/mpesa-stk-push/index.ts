// M-Pesa STK push: initiate a payment, receive Safaricom's callback, and let the
// browser poll for the outcome.
//
// All fulfilment lives in _shared/paymentEffects.ts and is applied server-side.
// This file only moves the payment through its states:
//
//   pending ──callback(ResultCode 0)──> completed  (+ effects applied)
//           ──callback(other)───────> failed
//           ──/status poll + Daraja STK query──> completed  (+ effects applied)
//           ──simulate + 15s─────────────────> completed  (+ effects applied)
//
// The /status poll is a real fallback, not just a mirror: Safaricom retries a
// timed-out callback and then stops, so a lost callback would otherwise leave a
// customer charged and unfulfilled forever.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  applyPaymentEffects,
  sendPaymentReceipt,
  type PaymentRow,
} from '../_shared/paymentEffects.ts'

const ALLOWED_ORIGINS = ['https://www.itukarua.co.ke', 'https://itukarua3.vercel.app', 'http://localhost:8080']

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// How long before we start asking Daraja directly, and how often.
const QUERY_AFTER_MS = 20_000
const SIMULATE_AFTER_MS = 15_000

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

/**
 * One-Day Contact Access redemption token. Minted server-side with
 * crypto.getRandomValues (never Math.random) so it is unpredictable and can be
 * enforced unique by the payments_token_unique index. Only contact_access
 * purchases receive a token.
 */
function generateContactToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let token = 'ITK-'
  for (const b of bytes) token += chars[b % chars.length]
  return token
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

/**
 * Ask Daraja what actually happened to a checkout request.
 *
 * Safaricom's own docs describe this as the way to settle an ambiguous
 * transaction, which is exactly the gap a lost callback leaves. Returns null
 * when Daraja has no record yet (still waiting on the customer).
 */
async function queryDaraja(checkoutRequestId: string): Promise<{ resultCode: number; mpesaRef?: string } | null> {
  try {
    const token = await getOAuthToken()
    const timestamp = getTimestamp()
    const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`)
    const res = await fetch(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
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
        CheckoutRequestID: checkoutRequestId,
      }),
    })
    const data = JSON.parse(await res.text())
    const payload = data?.Response ?? data?.response ?? {}
    const resultCode = Number(payload.ResultCode ?? payload.responseCode)
    if (!Number.isFinite(resultCode)) return null
    // The receipt number has moved around between Daraja response shapes.
    const mpesaRef =
      payload.MpesaReceiptNumber ??
      payload.mpesaReceiptNumber ??
      payload.ReceiptNumber ??
      undefined
    return { resultCode, mpesaRef: mpesaRef ? String(mpesaRef) : undefined }
  } catch (err) {
    console.error('[STK Query] failed:', err.message)
    return null
  }
}

function extractCallbackRef(callbackData: any): string {
  const items = callbackData?.Body?.stkCallback?.CallbackMetadata?.Item || []
  for (const item of items) {
    if (item?.Name === 'MpesaReceiptNumber' && item?.Value) return String(item.Value)
  }
  return ''
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
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
      const {
        phone,
        amount,
        accountRef,
        description,
        user_id,
        payment_type,
        related_job_id,
        related_ad_id,
        related_profile_id,
        related_account_id,
        related_invoice_id,
        token,
        metadata,
      } = await req.json()

      if (!phone || !amount) {
        return json({ error: 'Phone and amount required' }, 400)
      }

      // A contact unlock redeems against a specific jobseeker profile.
      if ((payment_type === 'contact_access' || payment_type === 'contact unlock') && !related_profile_id) {
        return json({ error: 'Contact access requires a profile to unlock' }, 400)
      }

      // Mint the redemption token server-side, and only for contact purchases.
      const mintToken = payment_type === 'contact_access' ? generateContactToken() : null
      void token

      const formattedPhone = formatPhone(phone)
      // Our own id, kept on the row as local_checkout_id. Daraja replaces
      // checkout_request_id with its own id below, and the browser needs an id
      // it can poll with before Daraja has answered, so both are stored.
      const localCheckoutId = `WS${Date.now()}`
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

      const { data: paymentData, error: insertErr } = await supabase
        .from('payments')
        .insert({
          user_id,
          payment_type: payment_type || 'registration',
          amount: Math.round(amount),
          mpesa_phone: formattedPhone,
          status: 'pending',
          description: description || accountRef || 'Payment',
          checkout_request_id: localCheckoutId,
          local_checkout_id: localCheckoutId,
          metadata: metadata && typeof metadata === 'object' ? metadata : null,
          related_job_id: related_job_id || null,
          related_ad_id: related_ad_id || null,
          related_profile_id: related_profile_id || null,
          related_account_id: related_account_id || null,
          related_invoice_id: related_invoice_id || null,
          token: mintToken,
        })
        .select('id')
        .single()

      if (insertErr) {
        console.error('[STK Push] DB insert error:', insertErr)
        return json({ error: 'Failed to create payment record' }, 500)
      }

      let darajaCheckoutId: string | null = null

      if (SIMULATE) {
        console.log('[STK Push] Simulation mode — payment auto-completes on first status poll after 15s')
      } else {
        try {
          const timestamp = getTimestamp()
          const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`)
          const oauthToken = await getOAuthToken()

          const stkRes = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${oauthToken}`,
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
            // Mark the row failed so it does not sit pending forever.
            await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentData?.id)
            return json({ error: `Daraja: ${darajaDesc}`, daraja: stkData }, 400)
          }

          darajaCheckoutId = stkData.CheckoutRequestID || null
          await supabase
            .from('payments')
            .update({ checkout_request_id: darajaCheckoutId })
            .eq('id', paymentData?.id)
        } catch (err) {
          console.error('[STK Push] Daraja call failed:', err.message)
          await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentData?.id)
          return json({ error: 'Payment service unavailable. Please try again.' }, 502)
        }
      }

      return json({
        success: true,
        // Prefer Daraja's id so the browser polls the row the callback will find.
        // Falls back to our local id, which /status also resolves.
        CheckoutRequestID: darajaCheckoutId || localCheckoutId,
        local_checkout_id: localCheckoutId,
        payment_id: paymentData?.id,
        simulated: SIMULATE,
        // Only contact purchases carry a redemption token, and only the minted
        // value is ever echoed back to the browser.
        token: mintToken,
      })
    }

    // ─── Handle Safaricom Callback ─────────────────────────────────
    if (req.method === 'POST' && path === '/callback') {
      const callbackData = await req.json()
      const { Body } = callbackData
      if (!Body?.stkCallback) {
        return json({ error: 'Invalid callback data' }, 400)
      }

      const { ResultCode, ResultDesc, CheckoutRequestID } = Body.stkCallback
      const mpesaRef = extractCallbackRef(callbackData)
      console.log('[STK Callback] ResultCode:', ResultCode, 'CheckoutRequestID:', CheckoutRequestID)

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

      // Accept either id: Daraja sends its own, but be forgiving if it echoes
      // ours, and fall back to a phone/time match if the id is unrecognised.
      let payment: PaymentRow | null = null
      {
        const { data } = await supabase
          .from('payments')
          .select('*')
          .eq('checkout_request_id', CheckoutRequestID)
          .maybeSingle()
        payment = data as PaymentRow | null
      }
      if (!payment && CheckoutRequestID) {
        const { data } = await supabase
          .from('payments')
          .select('*')
          .eq('local_checkout_id', CheckoutRequestID)
          .maybeSingle()
        payment = data as PaymentRow | null
      }

      if (!payment) {
        console.error('[STK Callback] no payment for CheckoutRequestID', CheckoutRequestID)
        // Always 200: Safaricom retries non-2xx responses, and retrying an
        // unresolvable id cannot help.
        return json({ ResultCode: 0, ResultDesc: 'Success' })
      }

      if (Number(ResultCode) === 0) {
        const result = await applyPaymentEffects(supabase, payment, { mpesaRef: mpesaRef || null })
        if (result.claimed) {
          if (result.error) {
            // Fulfilment failed but the money arrived. effects_applied_at stays
            // NULL so payments-reconcile repairs it.
            console.error('[STK Callback] payment completed but fulfilment failed:', result.error)
          } else {
            await sendPaymentReceipt(supabase, payment, mpesaRef || payment.mpesa_ref)
          }
        }
      } else {
        await supabase
          .from('payments')
          .update({ status: 'failed', mpesa_ref: mpesaRef || ResultDesc || null })
          .eq('id', payment.id)
        console.error('[STK Callback] payment failed:', ResultCode, ResultDesc)
      }

      return json({ ResultCode: 0, ResultDesc: 'Success' })
    }

    // ─── Query STK Push Status ─────────────────────────────────────
    if (req.method === 'GET' && path === '/status') {
      const checkoutRequestId = url.searchParams.get('CheckoutRequestID') || url.searchParams.get('checkout_request_id')
      if (!checkoutRequestId) {
        return json({ error: 'CheckoutRequestID required' }, 400)
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

      const lookup = async (column: string) => {
        const { data } = await supabase.from('payments').select('*').eq(column, checkoutRequestId).maybeSingle()
        return data as PaymentRow | null
      }
      let payment = await lookup('checkout_request_id')
      if (!payment) payment = await lookup('local_checkout_id')

      if (!payment) {
        return json({ success: true, resultCode: 1, resultDesc: 'Payment not found' })
      }

      if (payment.status === 'pending') {
        const createdAt = payment.created_at ? new Date(payment.created_at).getTime() : NaN
        const age = Date.now() - createdAt
        const threshold = SIMULATE ? SIMULATE_AFTER_MS : QUERY_AFTER_MS

        if (isNaN(createdAt) || age >= threshold) {
          if (SIMULATE) {
            const result = await applyPaymentEffects(supabase, payment)
            if (result.claimed && !result.error) {
              await sendPaymentReceipt(supabase, payment)
            }
            const { data: fresh } = await supabase.from('payments').select('*').eq('id', payment.id).maybeSingle()
            payment = (fresh as PaymentRow) || { ...payment, status: 'completed' }
          } else {
            // Ask Daraja directly. This is what makes a lost callback survivable.
            const queried = await queryDaraja(checkoutRequestId)
            if (queried && queried.resultCode === 0) {
              const result = await applyPaymentEffects(supabase, payment, { mpesaRef: queried.mpesaRef || null })
              if (result.claimed && !result.error) {
                await sendPaymentReceipt(supabase, payment, queried.mpesaRef)
              }
              const { data: fresh } = await supabase.from('payments').select('*').eq('id', payment.id).maybeSingle()
              payment = (fresh as PaymentRow) || { ...payment, status: 'completed' }
            } else if (queried && queried.resultCode !== 0) {
              await supabase
                .from('payments')
                .update({ status: 'failed', mpesa_ref: payment.mpesa_ref })
                .eq('id', payment.id)
                .eq('status', 'pending')
              payment = { ...payment, status: 'failed' }
            }
          }
        }
      }

      return json({ success: true, status: payment.status, payment })
    }

    return json({ error: 'Not found' }, 404)
  } catch (error) {
    console.error('[STK Push] Error:', error.message)
    return json({ error: error.message }, 500)
  }
})
