---
id: frontend
title: Frontend Guide
description: Components, page shell, proxy client, tools and conventions
sidebar_label: Frontend Guide
---

# Frontend Guide

## Page shell and navigation

`AppLayout` renders the shared chrome (header, footer, floating buttons) and switches the active
page. Several important cross-cutting props flow down to every page:

- `onNavigate(page)` — internal page switching.
- `onOpenAuth(mode, role?)` — open the auth modal (used by pricing, job pages, dashboard).
- `onOpenMpesa(...)` — open the M-Pesa payment modal.
- `onOpenEmployerPayment(jobId, title, onSuccess)` — employer contact unlock.
- `onStayAfterLogin()` / `setPendingScrollTarget()` — login/signup flows that should end somewhere
  specific, e.g. the Pricing page's `#jobseekers` anchor.

`PricingPage`, `PostJobPage` and `JobDetailPage` gate their CTA buttons against **auth state**
first: anonymous visitors are sent to the auth modal (and optionally back), rather than straight
into the STK prompt.

## Components of note

- **`AuthModal`** — register/login with role choice, profile form, terms/data-sharing consent,
  and a post-signup plan chooser for jobseekers (Free / Premium KES 100/mo) and employers
  (Employer Access / Single Job Token / Decide Later).
- **`MpesaModal`** — the STK-push UI; also renders the employer "Weekly vs Single day" plan
  chooser with the full feature lists from `PRICING_PLANS`.
- **`DashboardPage`** — the biggest file. Role-aware tabs (Overview, Bids, Jobs, Payments,
  Profile, Settings, …), plan comparison cards, analytics charts and the admin user list.
- **`JobDetailPage`** — bidding, bid sorting, awarding, job completion, ratings, contact unlock
  and the bidder profile modal.
- **`WorkerSearchModal`** — the employer-facing jobseeker directory with the contact-access gate.
- **`ChatBot`** — FAQ chatbot storing conversations in `chat_conversations` / `chat_messages`.

## Data fetching

- Server state → `@/hooks/useQueries.ts` (`useJobs`, `useProfiles`, `useServiceAds`, `usePayments`…).
- Mutations → direct calls into `@/lib/database.ts`, then `queryClient.invalidateQueries(...)`.
- Database access almost always goes through `database.ts` functions, **not** bare `supabase.from()`
  calls in components — the pages that do use bare calls (e.g. `WorkerSearchModal`'s access check)
  are the exception, and were kept because the queries are simple.

## Styling

- Tailwind utility classes, `@` alias → `src`, lucide-react icons, shadcn/ui components in
  `src/components/ui`.
- `src/lib/imageUtils.ts` compresses uploaded images before storage.
- Images are served through the same-origin `/img/` proxy (`proxyImageUrl`) to dodge ad-blockers
  that filter URLs containing `adverts`, and are cached immutably.

## SEO

- `src/lib/seo.tsx` builds per-page meta/OG/Twitter tags, JSON-LD organization + local business
  schemas. Pages wrap content in `<SEO title=… description=…>`. Route titles live in `Header.tsx`.
- A prebuild script (`scripts/generate-seo.mjs`) regenerates `public/sitemap.xml` and
  `robots.txt` from `SITE_URL`. See [Deployment](./../deployment/deployment.md).

## Key conventions

- Run `npx tsc -p tsconfig.app.json --noEmit` and `npm run build` before pushing.
- Never add comments unless the surrounding code is doing something subtle that already explains
  itself — this codebase self-documents with section banners (`// ─── Subscriptions ───`).
- React 18 hook-stability is a real constraint in `JobDetailPage` — every hook must run before
  the loading/not-found returns, or React throws "Rendered more hooks than during the previous
  render". Follow the existing pattern; don't reorder hooks.