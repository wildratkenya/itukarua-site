import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

export const SITE_URL = Deno.env.get('SITE_URL') || 'https://www.itukarua.co.ke'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export function createFreshTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  })
}

// SMTP credentials are stored as Supabase secrets (edge function env vars),
// which are never exposed to the browser. If they are not set, fall back to
// the active email_providers row (metadata + password) for backward
// compatibility with the admin tab.
export async function loadSmtpConfig(supabase?: any): Promise<SmtpConfig> {
  const host = Deno.env.get('SMTP_HOST')
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASS')
  const port = parseInt(Deno.env.get('SMTP_PORT') || '465')
  const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Itukarua'
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || user || 'noreply@itukarua.co.ke'

  if (host && user && pass) {
    return {
      host,
      port,
      secure: port === 465, // 465 = implicit TLS, 587/25 = STARTTLS
      user,
      pass,
      from: `${fromName} <${fromEmail}>`,
    }
  }

  if (supabase) {
    const { data: providers } = await supabase
      .from('email_providers')
      .select('*')
      .eq('is_active', true)
      .limit(1)

    const active = Array.isArray(providers) && providers.length > 0 ? providers[0] : null
    if (active?.smtp_host && active?.username && active?.password) {
      const dbPort = active.smtp_port || 465
      const secure = dbPort === 465
      const dbFromName = active.from_name || 'Itukarua'
      const dbFromEmail = active.from_email || active.username
      return {
        host: active.smtp_host,
        port: dbPort,
        secure,
        user: active.username,
        pass: active.password,
        from: `${dbFromName} <${dbFromEmail}>`,
      }
    }
  }

  throw new Error('SMTP not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS secrets in Supabase, or add a provider in Admin → Email Providers.')
}

// Create a client using the service role so edge functions can read
// email_providers regardless of RLS.
export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}

export function escapeHtml(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
