// Store one-time codes as HMACs, never as the six digits themselves.
//
// A plain SHA-256 of a six-digit code is reversible by enumeration in a few
// seconds, so the hash is keyed with a server-only secret and bound to the
// account it was issued to. A dedicated OTP_HASH_SECRET is preferred; the
// service-role key is already server-only and works as a fallback.

const encoder = new TextEncoder()

function secret(): string {
  return Deno.env.get('OTP_HASH_SECRET')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || ''
}

async function digest(userId: string, code: string): Promise<string> {
  const keyMaterial = secret()
  if (!keyMaterial) throw new Error('OTP hashing secret is not configured')

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keyMaterial),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`job-otp:${userId}:${code}`))
  return Array.from(new Uint8Array(mac))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function hashOtp(userId: string, code: string): Promise<string> {
  return digest(userId, code)
}

export async function otpMatches(userId: string, code: string, expected: string | null): Promise<boolean> {
  if (!expected) return false
  let actual: string
  try {
    actual = await digest(userId, code)
  } catch {
    return false
  }
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
