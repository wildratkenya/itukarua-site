---
id: deployment
title: Deployment
description: Vercel hosting, build pipeline and same-origin proxy rewrites
sidebar_label: Deployment
---

# Deployment

The app is a static Vite SPA deployed on **Vercel**. Pushing to `main` on
`wildratkenya/itukarua-site` triggers a production build and deploy automatically.

## Build pipeline

1. `npm install`
2. `npm run build` → `prebuild` regenerates `public/sitemap.xml` + `robots.txt`
   (`scripts/generate-seo.mjs`), then `tsc -b && vite build` (see `package.json`).
3. Vercel serves `dist/` with the rewrites from `vercel.json`.

## `vercel.json` rewrites

All external calls are made **same-origin** to avoid ad-blockers (which drop URLs containing
`adverts`), mixed-content issues and unstable direct browser→supabase.co connections:

| Source | Destination |
| --- | --- |
| `/img/a/:match*` | Supabase storage `adverts` bucket (public object) |
| `/img/:bucket/:match*` | Supabase storage `${bucket}` bucket |
| `/supabase-storage/:match*` | Supabase storage generic public bucket |
| `/supabase/:match*` | `https://xahaxtbudiubelemewna.supabase.co/:match*` (all REST/Auth through the proxy) |
| `/payments/confirm` | `.../functions/v1/mpesa-stk-push/callback` (Safaricom webhook) |
| `/:match*` (fallback) | `/index.html` (SPA fallback for the Router) |

Storage images also get `Cache-Control: public, max-age=31536000, immutable`.

## Why the Supabase proxy matters

`src/lib/supabase.ts` builds the client against the **relative** `/supabase` URL — never the raw
`*.supabase.co` host — so every query, auth call and realtime connection travels through the
Vercel rewrite. If you see CORS or "failed to fetch" locally but not in prod, the dev-server proxy
in `vite.config.ts` is the local equivalent.

## Deploying the docs (`docs/`)

The docs are served from the **same Vercel project** as the app, under the `/docs` path, so they
are reachable at:

- `https://itukarua3.vercel.app/docs/`
- `https://itukarua.co.ke/docs/` (once the custom domain is attached)
- `http://localhost:3000/docs/` (local `npm run start` / `npm run serve`)

`docs/docusaurus.config.ts` uses `baseUrl: '/docs/'` with `routeBasePath: '/'`, so doc pages live
at `/docs/intro`, `/docs/architecture/overview`, … and all assets under `/docs/assets/…`. The
build outputs files at the root of `docs/build/` (the `/docs` prefix is a URL prefix only), so the
app build copies `docs/build` → `dist/docs` and Vercel serves them statically.

### One-time Vercel project settings (dashboard, no repo changes)

In the `itukarua3` project → **Settings → Build & Development**, override:

- **Build Command:**
  ```bash
  npm run build && cd docs && npm ci --include=dev && npm run build && cd .. && node -e "require('fs').cpSync('docs/build','dist/docs',{recursive:true})"
  ```
- **Output Directory:** `dist`

Then add the custom domain `itukarua.co.ke` (and `www.itukarua.co.ke`) under
**Settings → Domains**. No `vercel.json` change is required: Vercel serves the static files under
`/docs/*` before the SPA `/(.*) → /index.html` fallback.

### Build locally

```bash
cd docs
npm install
npm run build     # → docs/build
```

## Post-deploy sanity checks

- `https://itukarua3.vercel.app` loads and internal navigation works (SPA fallback intact).
- `https://itukarua3.vercel.app/docs/` and `…/docs/intro` render the docs (not the app).
- `https://itukarua.co.ke/docs/` renders after the domain is attached.
- A storage image loads via `/img/...`.
- Login works (auth through `/supabase`).
- An M-Pesa callback reaches `/payments/confirm`.