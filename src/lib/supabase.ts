import { createClient } from '@supabase/supabase-js'

// Supabase anon key is public-by-design (safe for client-side).
// Override via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars.
const SUPABASE_URL = 'https://xahaxtbudiubelemewna.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhaGF4dGJ1ZGl1YmVsZW1ld25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MDYsImV4cCI6MjA5MDY5NzkwNn0.Y9YUpREWTY255lTh0RypLa5dr-nmzv6M8EYeWGIDkXs'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY

const originalFetch = globalThis.fetch.bind(globalThis);

// REST reads, writes and storage operations are routed through the same-origin
// /supabase reverse-proxy (Vite dev proxy / Vercel rewrite) instead of hitting
// supabase.co directly. Direct browser-to-supabase.co connections can die
// silently (ERR_CONNECTION_CLOSED / hanging HTTP3 writes), while the same-origin
// proxy is stable. Realtime stays direct.
//
// We override globalThis.fetch directly (rather than passing global.fetch to
// createClient) so every internal HTTP call — PostgREST, Auth, Storage — goes
// through the proxy. Passing the custom fetch via the Supabase client options
// only reliably intercepts auth calls; PostgREST calls bypass it.
function routedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = ((init?.method) || (typeof input !== 'string' && !(input instanceof URL) ? input.method : undefined) || 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  const isSupabaseRest =
    url.startsWith(`${supabaseUrl}/rest/v1/`) ||
    url.startsWith(`${supabaseUrl}/auth/v1/`) ||
    url.startsWith(`${supabaseUrl}/storage/v1/object/`);

  if (isSupabaseRest && typeof window !== 'undefined') {
    const target = `${window.location.origin}/supabase${url.slice(supabaseUrl.length)}`;
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
      undefined,
      (err) => console.error(`[supabase-proxy] error ${method} ${target}`, err?.name, err?.message)
    );
    return result;
  }
  return originalFetch(input, init);
}

// Override globalThis.fetch so ALL supabase internal calls (PostgREST, Auth,
// Storage) are routed through the proxy.
if (typeof window !== 'undefined') {
  globalThis.fetch = routedFetch as typeof globalThis.fetch;
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

// The Supabase client's internal fetchWithAuth wrapper calls getAccessToken()
// which can hang indefinitely when autoRefreshToken triggers a stalled network
// request.  Bypass it with a lightweight wrapper that reads the access token
// from our stored session (pure localStorage read — no network) and injects it
// as the Authorization header before routing through the proxy.
function fetchWithLocalAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let accessToken: string | null = null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved?.access_token) accessToken = saved.access_token;
    }
  } catch { /* ignore */ }

  const headers = new Headers(init?.headers);
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('apikey')) {
    headers.set('apikey', supabaseKey);
  }

  return routedFetch(input, { ...init, headers } as RequestInit);
}

const restClient = (supabase as any).rest;
if (restClient) {
  restClient.fetch = fetchWithLocalAuth;
}

// ─── Direct Proxy Fetch (bypasses Supabase client's fetchWithAuth) ──────────
// The Supabase JS client's internal fetchWithAuth wrapper calls getAccessToken()
// which hangs when autoRefreshToken triggers a stalled network request.  These
// helpers bypass the client entirely: read the JWT from localStorage (pure
// synchronous read) and make the request through the same-origin proxy.

function getLocalToken(): string {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) { const s = JSON.parse(raw); if (s?.access_token) return s.access_token; }
  } catch {}
  return supabaseKey;
}

export async function proxyRequest(
  path: string,
  method: string = 'GET',
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ data: any; error: any }> {
  const token = getLocalToken();
  const proxyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/supabase${path}`;
  const headers: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
  if (method !== 'GET') {
    headers.Prefer = 'return=minimal';
  }
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(proxyUrl, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try { return { data: null, error: JSON.parse(text) }; }
    catch { return { data: null, error: { message: text || `HTTP ${res.status}`, status: res.status } }; }
  }
  const text = await res.text();
  if (!text) return { data: null, error: null };
  try { return { data: JSON.parse(text), error: null }; }
  catch { return { data: text, error: null }; }
}

export function proxyTable(table: string) {
  const base = `/rest/v1/${table}`;
  function filter(col: string, val: any): string {
    return `${col}=eq.${encodeURIComponent(String(val))}`;
  }
  return {
    async update(data: Record<string, any>, col: string, val: any) {
      return proxyRequest(`${base}?${filter(col, val)}`, 'PATCH', data);
    },
    async insert(data: Record<string, any> | Record<string, any>[]) {
      return proxyRequest(base, 'POST', data, { Prefer: 'return=representation' });
    },
    async delete(col: string, val: any) {
      return proxyRequest(`${base}?${filter(col, val)}`, 'DELETE');
    },
  };
}

export async function proxyRpc(
  fn: string,
  params?: Record<string, any>,
): Promise<{ data: any; error: any }> {
  return proxyRequest(`/rest/v1/rpc/${fn}`, 'POST', params);
}

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
  try { raw = localStorage.getItem(SESSION_KEY); } catch { return; }
  if (!raw) return;
  let saved: any;
  try { saved = JSON.parse(raw); } catch { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } return; }
  if (!saved?.access_token || !saved?.refresh_token) {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    return;
  }

  // setSession only refreshes over the network when the access token is already
  // expired; otherwise it just validates and restores the stored session. Guard
  // it with a generous timeout so a stalled auth call can never block startup —
  // but NEVER wipe the stored credentials on a transient timeout or network
  // error, or every refresh that hiccups would force the user to re-login.
  const timeout = new Promise<{ error: any }>((resolve) =>
    setTimeout(() => resolve({ error: new Error('session-restore-timeout') }), 8000)
  );

  try {
    const result: any = await Promise.race([
      supabase.auth.setSession({
        access_token: saved.access_token,
        refresh_token: saved.refresh_token,
      }),
      timeout,
    ]);
    // Only drop the stored session when the server definitively rejects the
    // tokens (revoked/expired/invalid). Transient failures keep the saved
    // credentials so the next refresh can retry.
    const err = result?.error;
    if (err) {
      const msg = String(err?.message || err?.code || '');
      const status = err?.status || err?.code;
      const permanent = status === 401 || status === 403 ||
        /invalid_grant|revoked|session not found|user not found|jwt expired|no user/i.test(msg);
      if (permanent) {
        try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      }
    }
  } catch {
    // Unexpected throw — keep credentials for the next attempt.
  }
}

// ─── Image Optimization ─────────────────────────────────────────────────────

export const FALLBACK_IMAGE = '/images/services-fallback.jpg';

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

export function certificateObjectUrl(url: string): string {
  // Returns a same-origin /api/<path> URL that streams the object bytes
  // server-side (api/cert.js), so the Supabase storage URL is never exposed
  // to the browser. Falls back to the raw URL for non-Storage paths.
  if (!url || !url.startsWith(STORAGE_PREFIX) || typeof window === 'undefined') {
    return url;
  }
  const path = url.substring(STORAGE_PREFIX.length);
  const slash = path.indexOf('/');
  const bucket = slash > 0 ? path.slice(0, slash) : path;
  if (bucket !== 'adverts') return url;
  const rest = slash > 0 ? path.slice(slash + 1) : '';
  return `${window.location.origin}/api/${rest.split('/').map(encodeURIComponent).join('/')}`;
}

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.target as HTMLImageElement;
  if (!img.src.includes(FALLBACK_IMAGE)) {
    img.src = FALLBACK_IMAGE;
  }
}
