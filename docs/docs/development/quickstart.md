---
id: quickstart
title: Quickstart
description: Run Itukarua locally and open the docs
sidebar_label: Quickstart
---

# Quickstart

## Prerequisites

- Node **18+** (the app was developed against **v24.13.0**); npm **11.x**.
- A Supabase project (or the local Supabase CLI via `supabase/config.toml`).

## Run the app

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

The dev server proxies `/img/` and `/supabase` to `https://xahaxtbudiubelemewna.supabase.co`.
**There is no local `.env` needed for the happy path** — Supabase URL/anon key are hardcoded in
`src/lib/supabase.ts` (see [Environment](./../deployment/environment.md)).

## Checks before you push

```bash
npx tsc -p tsconfig.app.json --noEmit   # TS typecheck (app config)
npm run build                           # prebuild regenerates sitemap/robots, then typecheck + vite build
```

`npm run build` runs the `prebuild` script which regenerates `public/sitemap.xml` and
`robots.txt` from `SITE_URL` (`scripts/generate-seo.mjs`).

## Run the docs site (this repo's `docs/`)

```bash
cd docs
npm install
npm run start        # hot-reload dev server at http://localhost:3000/docs/
npm run build        # static production build → docs/build
npm run serve        # serve the build locally at http://localhost:3000/docs/
```

## Supabase local (optional)

`supabase/config.toml` describes the local stack. To use Edge Functions locally:

```bash
supabase start       # postgres + auth + edge runtime
supabase functions serve --env-file .env.local
```

```bash
# invoke an edge function locally (example: the OTP verifier)
supabase functions invoke verify-job-otp --body '{"otp":"123456"}'
```

See [Supabase Functions docs](https://supabase.com/docs/guides/functions/local-development) for
details.

## Common failure: "Rendered more hooks than during the previous render"

`JobDetailPage` (and anything that early-returns before hooks) must call **every hook before** any
loading/not-found return. Keep the `useX(query)` batch above the branch, exactly as the existing
component does — reordering hooks breaks React 18.