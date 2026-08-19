import { createServiceClient } from '../_shared/smtp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { user_id, otp_code } = body

    if (!user_id || !otp_code) {
      throw new Error('user_id and otp_code are required')
    }

    const supabase = createServiceClient()

    // Find the most recent unused OTP for this user
    const { data: otpRecord, error: fetchError } = await supabase
      .from('job_otps')
      .select('*')
      .eq('user_id', user_id)
      .eq('otp_code', otp_code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!otpRecord) {
      throw new Error('Invalid or expired verification code. Please request a new one.')
    }

    // Mark OTP as used
    await supabase
      .from('job_otps')
      .update({ used: true })
      .eq('id', otpRecord.id)

    return new Response(JSON.stringify({ valid: true, job_data: otpRecord.job_data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
