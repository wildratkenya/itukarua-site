// HMAC-signed unsubscribe links.
//
// The old link was GET /unsubscribe?email=<address>, so anyone could
// unsubscribe anyone. Tokens bind the address to a server-side secret; the
// secret never reaches the browser or the newsletter HTML.
//
// A dedicated NEWSLETTER_UNSUBSCRIBE_SECRET is preferred. When it is absent we
// fall back to the service-role key, which is already server-only: HMAC does
// not expose the key, so this is safe, though rotating the key invalidates
// outstanding links.

const encoder = new TextEncoder();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function unsubscribeSecret(): string {
  return Deno.env.get('NEWSLETTER_UNSUBSCRIBE_SECRET')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || '';
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signature(email: string): Promise<string> {
  const secret = unsubscribeSecret();
  if (!secret) throw new Error('Unsubscribe signing secret is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`unsubscribe:${normalizeEmail(email)}`));
  return toBase64Url(mac);
}

export async function signUnsubscribeToken(email: string): Promise<string> {
  return signature(email);
}

export async function verifyUnsubscribeToken(email: string, token: string): Promise<boolean> {
  if (!token) return false;
  let expected: string;
  try {
    expected = await signature(email);
  } catch {
    return false;
  }
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
