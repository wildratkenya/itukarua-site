// Shared CORS handling for edge functions.
//
// Origins come from the ALLOWED_ORIGINS env var (comma-separated) so a domain
// change is a dashboard edit rather than a redeploy of every function. The
// fallback list below keeps today's behaviour when the variable is unset.
//
// Credentials: true is never combined with a reflected origin here. These
// endpoints are public, and the browser rejects a wildcard-with-credentials
// response anyway.

const FALLBACK_ALLOWED_ORIGINS = [
  'https://www.itukarua.co.ke',
  'https://itukarua3.vercel.app',
  'http://localhost:8080',
]

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'

export function allowedOrigins(): string[] {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  return configured.length > 0 ? configured : FALLBACK_ALLOWED_ORIGINS
}

/** True when the request may call this function from the browser. */
export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('Origin')
  if (!origin) return true // non-browser caller, e.g. a server-side fetch or cron
  return allowedOrigins().includes(origin.replace(/\/+$/, ''))
}

/**
 * Echo the caller's origin when it is allowed, otherwise fall back to the first
 * configured origin. Never returns '*'.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = allowedOrigins()
  const resolved = origin && allowed.includes(origin.replace(/\/+$/, '')) ? origin : allowed[0]

  return {
    'Access-Control-Allow-Origin': resolved,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}
