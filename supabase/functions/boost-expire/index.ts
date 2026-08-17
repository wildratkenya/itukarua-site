import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date().toISOString()

    // Expire banner ad boosts
    const { count: bannerCount } = await supabase
      .from('advertisements')
      .update({ featured: false, boost_until: null })
      .not('boost_until', 'is', null)
      .lt('boost_until', now)
      .eq('featured', true)

    // Expire service ad boosts
    const { count: serviceCount } = await supabase
      .from('service_ads')
      .update({ featured: false, boost_until: null })
      .not('boost_until', 'is', null)
      .lt('boost_until', now)
      .eq('featured', true)

    return new Response(
      JSON.stringify({ success: true, bannerExpired: bannerCount, serviceExpired: serviceCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
