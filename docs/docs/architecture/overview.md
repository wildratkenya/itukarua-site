---
id: overview
title: Architecture Overview
description: Repository layout and the big architectural decisions
sidebar_label: Overview
---

# Architecture Overview

## Repository layout

```
src/
  App.tsx                BrowserRouter with /, /advertise, /admin (SPA shell)
  components/
    AppLayout.tsx        Wraps every app page: header, footer, auth, M-Pesa, chatbot
    ui/                  shadcn/ui primitives (button, dialog, table, …)
    itukarua/            The actual product pages, modals and widgets (42 files)
    itukarua/admin/      Admin dashboard sub-components
  contexts/              Auth context (session, profile, role)
  data/                  Static product data (siteData.ts) and legal content
  hooks/                 TanStack Query hooks + toast/mobile helpers
  lib/                   database.ts, supabase.ts, mpesa.ts, seo.tsx, billing, …
  pages/                 Index.tsx, NotFound.tsx (thin React Router roots)
supabase/
  config.toml            Local Supabase CLI config
  functions/             Deno Edge Functions
  migrations/            SQL migrations (timestamped, chronological)
docs/                    This documentation site (Docusaurus)
```

## One SPA, many "pages"

The site is a **single-page application**. React Router only handles three real routes
(`/`, `/advertise`, `/admin`); everything else is an *internal page* switched inside
`AppLayout` through a discriminated `Page` union (defined in `Header.tsx`):

```ts
export type Page =
  | 'home' | 'jobs' | 'services' | 'pricing' | 'about' | 'contact'
  | 'dashboard' | 'inbox' | 'job-detail' | 'service-detail'
  | 'post-job' | 'post-advert' | 'advertise' | 'admin'
  | 'corporate' | 'corporate-signup';
```

Pages navigate with `onNavigate(page)`; `AppLayout` renders the matching component and also hosts
the cross-cutting UI — the auth modal (`AuthModal`), the M-Pesa payment modal (`MpesaModal`), the
chatbot, and the post-signup payment gate.

## Framework choices and why

- **React Query** (`src/hooks/useQueries.ts`) manages server-state for jobs, profiles, adverts and
  payments, with sensible `staleTime`/`gcTime` defaults.
- **Supabase JS client** is created once in `src/lib/supabase.ts` and — importantly — *every*
  PostgREST/Auth/Storage call is re-routed through a **same-origin proxy** (`/supabase`, see
  [Deployment](./../deployment/deployment.md)) because direct browser→supabase.co connections were
  unstable. Session persistence is manual (`localStorage`, key `itukarua_session`) because the
  client runs with `persistSession: false`.
- **Tailwind + shadcn/ui** for styling; product code tends to use plain Tailwind classes with
  lucide-react icons.
- **Recharts** for the dashboard analytics charts (`ProfileViewsChart`, `JobViewsChart`,
  `SiteTrafficChart`, advertiser/corporate charts).

## Payments at a high level

1. The UI opens `MpesaModal` with an amount, description, account reference and `paymentType`.
2. It calls `mpesa-stk-push` (Edge Function), which triggers the STK prompt and returns `CheckoutRequestID`.
3. The app polls `payments-reconcile` (or waits for the webhook callback) until the `payments`
   row is `completed`.
4. Fulfilment runs in the Edge Function shared helper **`paymentEffects.ts`** — it is the single
   idempotent place that grants subscriptions, adverts, contact windows and boosts.

The full product rules — every plan, every gate — are covered in
[Pricing & plans](./../product/pricing-and-plans.md) and [Roles & gating](./../product/roles-and-gating.md).