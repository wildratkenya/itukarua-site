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
import { minimumAmountKes, underpaymentMessage } from '../_shared/pricing.ts'
import { corsHeadersFor } from '../_shared/cors.ts'

const CONSUMER_KEY = Deno.env.get('MPESA_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET')!
const PASSKEY = Deno.env.get('MPESA_PASSKEY') || ''
const SHORTCODE = Deno.env.get('MPESA_SHORTCODE') || ''
// Buy Goods (till) needs two different numbers in the Daraja request, and
// Safaricom pairs them against the outlet's agent/store records. MPESA_SHORTCODE
// keys the password and goes in BusinessShortCode; MPESA_PARTY_B is the second
// number (falls back to MPESA_SHORTCODE for a Paybill, which uses one number).
const PARTY_B = Deno.env.get('MPESA_PARTY_B') || SHORTCODE
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SIMULATE = Deno.env.get('MPESA_SIMULATE') === 'true'

const DARAJA_BASE = Deno.env.get('MPESA_BASE_URL') || 'https://sandbox.safaricom.co.ke'

// How long before we start asking Daraja directly, and how often.
const QUERY_AFTER_MS = 20_000
const SIMULATE_AFTER_MS = 15_000

function getTimestamp(): string {
  const eat = new Date(Date.now() + 3 * 60 * 60 * 1000)
  const p = (n: number) => n.toString().padStart(2, '0')
  return (
    `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}` +
    `${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`
  )
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

/**
 * Unguessable id the browser can poll before Daraja answers.
 *
 * This used to be WS + Date.now(), which made pending payments enumerable:
 * anyone could walk the range, read them from /status and forge a callback for
 * one. The id must not carry a timestamp.
 */
function randomCheckoutId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return 'WS' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/mpesa-stk-push/, '') || '/'
  const corsHeaders = corsHeadersFor(req)

  // Every response needs the CORS headers, not just the OPTIONS preflight:
  // without them the browser reports a plain network failure ("Failed to
  // fetch") and the JSON body — including the 400s — never reaches the app.
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })

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
      const localCheckoutId = randomCheckoutId()
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

      // Corporate placements are paid against an invoice, so the server decides
      // what is due and who is paying: the browser's amount and user id are not
      // trusted for this flow. Every other payment type is unchanged.
      let effectiveAmount = Math.round(amount)
      let effectiveUserId = user_id || null
      let isCorporatePayment = false

      if (payment_type === 'corporate' || related_account_id || related_invoice_id) {
        isCorporatePayment = true
        if (!related_account_id || !related_invoice_id) {
          return json({ error: 'A corporate payment needs both the corporate account and the invoice' }, 400)
        }

        const { data: invoice } = await supabase
          .from('corporate_invoices')
          .select('id, account_id, amount, status, invoice_no')
          .eq('id', related_invoice_id)
          .maybeSingle()
        if (!invoice) return json({ error: 'Corporate invoice not found' }, 404)
        if (invoice.account_id !== related_account_id) {
          return json({ error: 'That invoice does not belong to this corporate account' }, 403)
        }
        if (invoice.status === 'paid') {
          return json({ error: 'This invoice has already been paid' }, 400)
        }
        if (invoice.status !== 'issued' && invoice.status !== 'overdue') {
          return json({ error: 'This invoice is not awaiting payment' }, 400)
        }

        const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
        if (!bearer) return json({ error: 'Sign in to pay a corporate invoice' }, 401)
        const { data: userData, error: userErr } = await supabase.auth.getUser(bearer)
        if (userErr || !userData?.user) return json({ error: 'Sign in to pay a corporate invoice' }, 401)
        const uid = userData.user.id

        const { data: member } = await supabase
          .from('corporate_members')
          .select('id, member_role')
          .eq('account_id', related_account_id)
          .eq('profile_id', uid)
          .maybeSingle()
        if (!member) {
          return json({ error: 'Only a member of this corporate account can pay its invoice' }, 403)
        }

        effectiveAmount = Math.round(Number(invoice.amount))
        effectiveUserId = uid
        console.log(`[STK Push] corporate payment for invoice ${invoice.invoice_no} (${effectiveAmount}) by ${uid}`)
      }

      if (!Number.isFinite(effectiveAmount) || effectiveAmount < 1) {
        return json({ error: 'Invalid payment amount' }, 400)
      }

      // The browser chooses the product, not the price. Corporate totals come
      // from the invoice above; everything else must cover the canonical price.
      if (!isCorporatePayment) {
        let profileRole: string | null = null
        if (effectiveUserId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', effectiveUserId)
            .maybeSingle()
          profileRole = (profile as any)?.role ?? null
        }
        const minimum = await minimumAmountKes(
          supabase,
          {
            payment_type: payment_type || 'registration',
            metadata: metadata && typeof metadata === 'object' ? metadata : null,
          },
          profileRole,
        )
        if (minimum !== null && effectiveAmount < minimum) {
          return json({ error: underpaymentMessage(minimum, effectiveAmount) }, 400)
        }
      }

      const { data: paymentData, error: insertErr } = await supabase
        .from('payments')
        .insert({
          user_id: effectiveUserId,
          payment_type: payment_type || 'registration',
          amount: effectiveAmount,
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
              Amount: effectiveAmount,
              PartyA: formattedPhone,
              PartyB: PARTY_B,
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
            // Mark the row failed so it does not sit pending forever, and keep
            // the reason so the admin list can show why.
            await supabase
              .from('payments')
              .update({ status: 'failed', mpesa_ref: darajaDesc || null, updated_at: new Date().toISOString() })
              .eq('id', paymentData?.id)
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

      // Optional shared secret. Point MPESA_CALLBACK_URL at
      // /functions/v1/mpesa-stk-push/callback?s=<MPESA_CALLBACK_SECRET> to
      // require it. The Daraja verification below is the primary defence and
      // runs either way.
      const callbackSecret = Deno.env.get('MPESA_CALLBACK_SECRET') || ''
      if (callbackSecret) {
        const provided = url.searchParams.get('s') || path.split('/')[2] || ''
        if (provided !== callbackSecret) {
          console.error('[STK Callback] rejected: bad callback secret')
          return json({ error: 'Unauthorized' }, 401)
        }
      } else {
        console.warn('[STK Callback] MPESA_CALLBACK_SECRET is not set; verifying with Daraja only')
      }

      const { ResultCode, ResultDesc, CheckoutRequestID } = Body.stkCallback
      const mpesaRef = extractCallbackRef(callbackData)
      console.log('[STK Callback] ResultCode:', ResultCode, 'CheckoutRequestID:', CheckoutRequestID)

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

      // Only Daraja's own CheckoutRequestID can settle a payment. The local id
      // the browser polls with is not proof that Safaricom sent this request.
      const { data } = CheckoutRequestID
        ? await supabase
            .from('payments')
            .select('*')
            .eq('checkout_request_id', CheckoutRequestID)
            .maybeSingle()
        : { data: null }
      const payment = data as PaymentRow | null

      if (!payment) {
        console.error('[STK Callback] no payment for CheckoutRequestID', CheckoutRequestID)
        // Always 200: Safaricom retries non-2xx responses, and retrying an
        // unresolvable id cannot help.
        return json({ ResultCode: 0, ResultDesc: 'Success' })
      }

      // A callback is only a claim; the STK query is the settlement authority.
      // A forged success POST cannot make Daraja report money that never moved,
      // and a forged failure POST cannot cancel a payment Daraja already took.
      const verdict = SIMULATE
        ? { resultCode: Number(ResultCode), mpesaRef: mpesaRef || undefined }
        : await queryDaraja(payment.checkout_request_id || CheckoutRequestID)

      // No verdict (Daraja unreachable or has no record yet): never complete on
      // the callback's word, but honour a reported failure since it grants
      // nothing.
      const settled: number | null = verdict
        ? verdict.resultCode
        : Number(ResultCode) === 0
          ? null
          : Number(ResultCode)

      if (settled === null || settled === 1037) {
        // 1037 means Safaricom has not finished with the request. Leave the
        // payment pending rather than fail a live sale; /status and
        // payments-reconcile settle it once Daraja answers.
        console.warn('[STK Callback] unverified, leaving payment pending:', payment.id, 'code', settled)
        return json({ ResultCode: 0, ResultDesc: 'Accepted, pending verification' })
      }

      if (settled !== 0) {
        await supabase
          .from('payments')
          .update({ status: 'failed', mpesa_ref: verdict?.mpesaRef || mpesaRef || null, updated_at: new Date().toISOString() })
          .eq('id', payment.id)
          .neq('status', 'completed')
        console.error('[STK Callback] payment failed:', settled, ResultDesc)
        return json({ ResultCode: 0, ResultDesc: 'Success' })
      }

      const result = await applyPaymentEffects(supabase, payment, {
        mpesaRef: verdict?.mpesaRef || mpesaRef || null,
      })
      if (result.claimed) {
        if (result.error) {
          // Fulfilment failed but the money arrived. effects_applied_at stays
          // NULL so payments-reconcile repairs it.
          console.error('[STK Callback] payment completed but fulfilment failed:', result.error)
        } else {
          await sendPaymentReceipt(supabase, payment, verdict?.mpesaRef || mpesaRef || payment.mpesa_ref)
        }
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
        return json({ success: true, status: 'not_found', resultDesc: 'Payment not found' })
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
            // Always query with Daraja's own id: a local id would only produce an
            // error, and 1037 means "still processing", not "failed".
            const queried = await queryDaraja(payment.checkout_request_id || checkoutRequestId)
            if (queried && queried.resultCode === 0) {
              const result = await applyPaymentEffects(supabase, payment, { mpesaRef: queried.mpesaRef || null })
              if (result.claimed && !result.error) {
                await sendPaymentReceipt(supabase, payment, queried.mpesaRef)
              }
              const { data: fresh } = await supabase.from('payments').select('*').eq('id', payment.id).maybeSingle()
              payment = (fresh as PaymentRow) || { ...payment, status: 'completed' }
            } else if (queried && queried.resultCode !== 0 && queried.resultCode !== 1037) {
              await supabase
                .from('payments')
                .update({ status: 'failed', mpesa_ref: payment.mpesa_ref, updated_at: new Date().toISOString() })
                .eq('id', payment.id)
                .eq('status', 'pending')
              payment = { ...payment, status: 'failed' }
            }
          }
        }
      }

      // Status only. The full row carries the customer's phone, metadata and the
      // contact-access redemption token, and this endpoint is unauthenticated.
      return json({
        success: true,
        status: payment.status,
        mpesa_ref: payment.mpesa_ref,
        access_expires_at: payment.access_expires_at ?? null,
      })
    }

    return json({ error: 'Not found' }, 404)
  } catch (error) {
    console.error('[STK Push] Error:', error.message)
    return json({ error: error.message }, 500)
  }
})
