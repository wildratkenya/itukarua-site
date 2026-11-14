---
id: session-handling
title: Session Handling Design Note
description: Current session mechanics (itukarua_session localStorage) vs. a cookie-based migration path
sidebar_label: Session Handling
---

# Session Handling Design Note

> **Status:** Design note only. No session code changes are included in this hardening cycle.
> Item #7 documents the current mechanics, the trade-offs, and a recommended migration path.
> The implementation decision is intentionally deferred.

## a) Current setup

`src/lib/supabase.ts` creates the Supabase JS client with:

- `persistSession: false` — auth-js does not keep its own lock/localStorage session.
- `autoRefreshToken: true`, `detectSessionInUrl: true`.
- `autoFetchUser: true` (default).

The app manually persists the session under `localStorage` key `itukarua_session`:

```ts
const SESSION_KEY = 'itukarua_session';
// saved shape: { access_token, refresh_token, expires_at }
```

`saveSession(session)` writes to localStorage on every successful login/signup/refresh.
`restoreSession()` runs at boot, calls `supabase.auth.setSession({access_token, refresh_token})`
guarded by an 8s timeout, and only drops the stored credentials when the server definitively
rejects them (401/403 / `invalid_grant` / `revoked` / `session not found`). Transient failures
keep the saved credentials so a hiccup never forces re-login.

`fetchWithLocalAuth()` injects the stored `access_token` as the `Authorization: Bearer ...`
header before routing through the same-origin `/supabase` proxy. A lapsed token (`expires_at <= now`)
is treated as no session so public reads fall back to the anon key instead of returning `401 JWT
expired`.

`vercel.json` rewrites `/supabase/:match*` → `https://xahaxtbudiubelemewna.supabase.co/:match*`
and `/payments/confirm` → the M-Pesa callback function, so all REST/Auth/Storage traffic goes
through the same-origin proxy.

### Trade-offs

| Concern | Current (`itukarua_session` localStorage) |
| --- | --- |
| **XSS exposure** | **High.** Any script running on the origin can read `itukarua_session` and exfiltrate the JWT + refresh token. This is the dominant risk of localStorage sessions. |
| **Cross-tab resilience** | **Good.** localStorage is shared across tabs/windows on the same origin; a login in one tab is visible everywhere. |
| **Reload resilience** | **Good.** Survives page refreshes and tab closes until sign-out. |
| **Safari ITP** | **Neutral.** localStorage is not subject to ITP's 7-day cap on client-side cookies (ITP only caps document.cookie). This is the one area where localStorage beats short-lived cookies on iOS Safari. |
| **CSRF** | Not applicable — localStorage is not sent automatically by the browser, so there is no CSRF surface for session reads. |
| **Refresh rotation races** | Moderate. `ensureValidToken()` races `supabase.auth.refreshSession()` against an 8s timeout; concurrent tabs can both refresh and the last write to localStorage wins. Auth-js rotates refresh tokens on each refresh, so a stale tab holding an old refresh token can fail its next refresh, but the stored access_token keeps working until expiry. |
| **Same-origin proxy** | Good. `/supabase` stays on the origin, avoiding ERR_CONNECTION_CLOSED / HTTP3 hangs on direct supabase.co calls. |

## b) Recommended migration path

The goal is to move from localStorage-held JWTs to **HttpOnly; Secure; SameSite=Lax cookies** while
keeping the cross-tab/reload and Safari-ITP resilience the app depends on.

### Option 1 — Standard Supabase `persistSession: true` + PKCE (retain localStorage-backed auth-js)

Auth-js manages its own `sb-...` localStorage keys and PKCE flow. `persistSession: true` keeps
the session across reloads; `autoRefreshToken` rotates refresh tokens on use.

**Pros:** Minimal code change; auth-js handles refresh/rotation/PKCE natively; battle-tested.
**Cons:** Still localStorage — the XSS exposure stays exactly where it is today. Does not
address the core finding of this note. Safari ITP does not affect localStorage, so this
remains the most iOS-resilient option of the three.

### Option 2 — Same-origin Vercel Edge/Function proxy (`/supabase`) setting `HttpOnly; Secure; SameSite=Lax` cookies

The `/supabase` reverse proxy (already in `vercel.json`) would be extended into a small
same-origin auth gateway:

1. Login/signup POSTs to `/supabase/auth/v1/token` (proxied). Supabase responds with
   `access_token` / `refresh_token` in JSON.
2. A thin Edge Function (or Vercel middleware) intercepts the auth response, extracts the
   tokens, and sets `Set-Cookie: sb-access=...; HttpOnly; Secure; SameSite=Lax; Path=/` and
   `sb-refresh=...; HttpOnly; Secure; SameSite=Lax; Path=/`.
3. The SPA never touches the tokens in JS; every request to `/supabase` carries the cookies
   automatically (they are same-origin).
4. The proxy forwards the `Authorization: Bearer <access_token>` header to Supabase on
   behalf of the client, using the cookie value.
5. Refresh is handled server-side: when Supabase returns `401`, the proxy uses the
   `sb-refresh` cookie to call `/auth/v1/token?grant_type=refresh_token`, rotates the
   refresh token, and rewrites both `Set-Cookie` headers on the response.

**Handling refresh rotation and cross-tab races:**

- **Rotation:** Each successful refresh issues a new refresh token. The proxy overwrites
  `sb-refresh` on every refresh response. A tab that holds the previous refresh token will
  fail its next refresh with `invalid_grant` — expected and safe: that tab still has a valid
  access token (in cookie form) until it expires, and the first tab to refresh wins.
- **Race across tabs:** Because cookies are shared by the browser, all tabs see the same
  `sb-access` / `sb-refresh` values. The proxy's refresh is idempotent-ish: the second
  concurrent refresh attempt for the same user will race Supabase's rotation; one wins, the
  other gets `invalid_grant` but still holds a live access cookie. No tab is logged out
  spuriously.
- **Safari ITP:** `HttpOnly` cookies *are* subject to ITP's 7-day cap on `document.cookie`
  writes unless the site has user interaction. With `SameSite=Lax` and regular user visits,
  this is usually acceptable; for pure token storage the cap applies to the cookie's lifetime
  rather than reads. If long idle periods on iOS are a concern, pair with a server-side
  refresh-on-every-request pattern or accept re-login after ~7 days of inactivity.

**Pros:** Eliminates the XSS exfiltration vector (tokens never touch JS); keeps cross-tab
and reload resilience via shared cookies; works through the existing `/supabase` proxy.
**Cons:** Larger change than Option 1; introduces a cookie-rotation race that must be
tested across tabs; ITP cap on cookie writes.

### Recommendation

For this codebase, **Option 2** is the right direction because it removes the XSS exposure
that localStorage cannot mitigate. The migration should be staged:

1. Ship Option 2 behind a feature flag; keep the `itukarua_session` localStorage path as a
   fallback during the rollout.
2. Write cross-tab refresh-race tests (two tabs, simultaneous expiry, verify exactly one
   rotation succeeds and no tab loses its session).
3. Verify Safari ITP behavior (7-day cookie cap) against actual usage patterns; if idle
   sessions matter more than XSS resistance for the iOS user base, reconsider keeping
   localStorage for the refresh token only.
4. Once stable, delete `saveSession`/`restoreSession`/`fetchWithLocalAuth` localStorage
   machinery and enable `persistSession: true` only if auth-js is still needed for PKCE
   (otherwise drop it entirely in favor of the proxy).

### Out of scope for this audit

- Changing `src/lib/supabase.ts`, `vercel.json`, or any Edge Function to set cookies.
- Rotating existing `itukarua_session` tokens.
- Any production rollout of cookie-based auth.
