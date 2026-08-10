import { createClient } from '@supabase/supabase-js'

// Supabase anon key is public-by-design (safe for client-side).
// Override via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars.
const SUPABASE_URL = 'https://xahaxtbudiubelemewna.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhaGF4dGJ1ZGl1YmVsZW1ld25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MDYsImV4cCI6MjA5MDY5NzkwNn0.Y9YUpREWTY255lTh0RypLa5dr-nmzv6M8EYeWGIDkXs'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY

const originalFetch = globalThis.fetch.bind(globalThis);

// Writes (INSERT/UPDATE/DELETE to the REST API, plus storage uploads/deletes)
// are routed through the same-origin /supabase reverse-proxy (Vercel rewrite)
// instead of hitting supabase.co directly. The browser-to-supabase.co HTTP/3
// (QUIC) connection can silently die between writes, hanging the 2nd+ save and
// storage uploads while GETs (auto-retried by the browser) keep working.
// Reads, auth and realtime stay direct.
function routedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = ((init?.method) || (typeof input !== 'string' && !(input instanceof URL) ? input.method : undefined) || 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  const isProxiedWrite =
    method !== 'GET' &&
    (url.startsWith(`${supabaseUrl}/rest/v1/`) || url.startsWith(`${supabaseUrl}/storage/v1/object/`));

  if (isProxiedWrite && typeof window !== 'undefined') {
    const target = `${window.location.origin}/supabase${url.slice(supabaseUrl.length)}`;
    console.log('[supabase-proxy]', method, '->', target);
    let result: Promise<Response>;
    if (typeof input === 'string') {
      result = originalFetch(target, init);
    } else {
      const req = input as Request;
      result = originalFetch(target, {
        method: req.method,
        headers: init?.headers ?? req.headers,
        body: init?.body ?? req.body,
        signal: init?.signal ?? req.signal,
        credentials: init?.credentials ?? req.credentials,
        cache: init?.cache ?? req.cache,
        redirect: init?.redirect ?? req.redirect,
        integrity: init?.integrity ?? req.integrity,
        referrer: init?.referrer ?? req.referrer,
      });
    }
    result.then(
      (res) => console.log(`[supabase-proxy] <- ${method} ${target} -> ${res.status}`),
      (err) => console.error(`[supabase-proxy] <! ${method} ${target}`, err?.name, err?.message)
    );
    return result;
  }
  return originalFetch(input, init);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'apikey': supabaseKey,
    },
    fetch: routedFetch,
  },
});

// ─── Manual Session Persistence ─────────────────────────────────────────────
// The client runs with persistSession: false (auth-js localStorage/lock
// machinery was unreliable in this app), so we store the session ourselves and
// restore it on load. Survives page refreshes until sign-out.

const SESSION_KEY = 'itukarua_session';

export function saveSession(session: any) {
  try {
    if (session?.access_token && session?.refresh_token) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      }));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch { /* storage unavailable — session just won't survive refresh */ }
}

export async function restoreSession(): Promise<void> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (!saved?.access_token || !saved?.refresh_token) { localStorage.removeItem(SESSION_KEY); return; }
    // setSession only refreshes over the network when the access token is already expired;
    // guard it with a timeout so a stalled refresh can never block startup.
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('session-restore-timeout')), 5000));
    await Promise.race([supabase.auth.setSession({
      access_token: saved.access_token,
      refresh_token: saved.refresh_token,
    }), timeout]);
  } catch {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }
}

// ─── Image Optimization ─────────────────────────────────────────────────────

export const FALLBACK_IMAGE = 'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055543861_b8e656f2.jpg';

const STORAGE_PREFIX = `${supabaseUrl}/storage/v1/object/public/`;

const BUCKET_ALIASES: Record<string, string> = { adverts: 'a' }
const BUCKET_ALIASES_REVERSE: Record<string, string> = { a: 'adverts' }

export function optimizeImageUrl(url: string, width: number = 400, height: number = 400): string {
  if (!url || !url.startsWith(supabaseUrl)) {
    return url;
  }
  
  if (url.startsWith(STORAGE_PREFIX) && typeof window !== 'undefined') {
    const origin = window.location.origin;
    const path = url.substring(STORAGE_PREFIX.length);
    const slash = path.indexOf('/');
    const bucket = slash > 0 ? path.slice(0, slash) : path;
    const rest = slash > 0 ? path.slice(slash + 1) : '';
    const safe = BUCKET_ALIASES[bucket];
    if (safe) {
      return `${origin}/img/${safe}/${rest}?width=${width}&height=${height}&resize=cover&quality=80&format=webp`;
    }
  }
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&height=${height}&resize=cover&quality=80&format=webp`;
}

export function proxyImageUrl(url: string): string {
  // Same-origin /img/<alias>/<rest> avoids ad blockers that filter URLs containing "adverts".
  if (!url || !url.startsWith(supabaseUrl) || typeof window === 'undefined') return url;
  if (url.startsWith(STORAGE_PREFIX)) {
    const origin = window.location.origin;
    const path = url.substring(STORAGE_PREFIX.length);
    const slash = path.indexOf('/');
    const bucket = slash > 0 ? path.slice(0, slash) : path;
    const rest = slash > 0 ? path.slice(slash + 1) : '';
    const safe = BUCKET_ALIASES[bucket];
    if (safe) return `${origin}/img/${safe}/${rest}`;
  }
  return url;
}

export function restoreStorageUrl(proxyPath: string): string {
  // /img/a/admin/foo.jpg -> https://xahaxtbudiubelemewna.supabase.co/storage/v1/object/public/adverts/admin/foo.jpg
  const parts = proxyPath.replace(/^\/img\//, '').split('/');
  if (parts.length < 2) return proxyPath;
  const safe = parts[0];
  const bucket = BUCKET_ALIASES_REVERSE[safe] || safe;
  const rest = parts.slice(1).join('/');
  return `${STORAGE_PREFIX}${bucket}/${rest}`;
}

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.target as HTMLImageElement;
  if (!img.src.includes(FALLBACK_IMAGE)) {
    img.src = FALLBACK_IMAGE;
  }
}
