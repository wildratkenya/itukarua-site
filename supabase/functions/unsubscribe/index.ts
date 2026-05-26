import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = Deno.env.get('SITE_URL') || 'https://itukarua3.vercel.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const email = url.searchParams.get('email')

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return new Response(htmlPage('Invalid Link', 'The unsubscribe link appears to be invalid.'), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error } = await supabase.from('newsletter_subscribers').delete().eq('email', email)

    if (error) {
      return new Response(htmlPage('Error', 'Something went wrong. Please try again.'), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      })
    }

    return new Response(htmlPage('Unsubscribed', `You've been removed from Itukarua newsletters.`, true), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    })
  } catch {
    return new Response(htmlPage('Error', 'Something went wrong.'), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    })
  }
})

function htmlPage(title: string, message: string, success = false): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} - Itukarua</title>
<style>
  body{margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1);max-width:400px;margin:20px}
  h1{font-size:24px;margin:0 0 12px;color:${success ? '#059669' : '#111827'}}
  p{color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.5}
  a{display:inline-block;padding:10px 24px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}
  .icon{font-size:48px;margin-bottom:12px}
</style></head>
<body>
  <div class="card">
    <div class="icon">${success ? '✅' : '⚠️'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${SITE_URL}">Back to Itukarua</a>
  </div>
</body></html>`
}
