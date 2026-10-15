---
id: intro
title: Introduction
description: What Itukarua is and how this documentation is organised
sidebar_label: Introduction
---

# Introduction

**Itukarua** is a Kenya-based online marketplace that connects three audiences on one platform:

- **Jobseekers** — skilled (and semi-skilled) workers who bid on posted jobs.
- **Employers** — individuals, shops, firms and institutions that post jobs and hire.
- **Advertisers** — businesses that promote their products, services and job openings.

The production application lives at **https://itukarua3.vercel.app** and the source lives in the
[`wildratkenya/itukarua-site`](https://github.com/wildratkenya/itukarua-site) repository on `main`.
Commits to `main` are auto-deployed to Vercel.

## What this documentation covers

| Section | What you will find |
| --- | --- |
| [Architecture](./architecture/overview.md) | Repo layout, framework choices, the SPA page shell, Supabase client and the Edge Function inventory. |
| [Product & Gating](./product/pricing-and-plans.md) | The exact plans (Free/Premium jobseeker, employer, advert, featured boost, corporate), and how each advertised feature is enforced. |
| [Development](./development/quickstart.md) | Running the app locally, database migrations, lint/typecheck/build. |
| [Deployment](./deployment/deployment.md) | Vercel configuration, environment variables and the same-origin proxy. |
| [Contributing](./contributing/git-hygiene.md) | Commit hygiene and gotchas that have bit the team before. |

## Tech stack at a glance

- **Frontend:** React 18 + TypeScript + Vite, React Router, TanStack Query, Tailwind CSS, shadcn/ui, Recharts.
- **Backend:** Supabase (Postgres, Auth, Storage) with Deno **Edge Functions** for payments, OTPs, email, corporate billing and cron jobs.
- **Payments:** Safaricom **M-Pesa STK push** via the `mpesa-stk-push` Edge Function, fulfilled idempotently by `payment-effects`.
- **Hosting:** Vercel (static SPA) with same-origin `/supabase`, `/img` and `/payments/confirm` rewrites.

## Where the interesting logic lives

The single most important file is **`src/lib/database.ts`** (~2,600 lines): it is the typed client
for Supabase and contains the real product rules — entitlements, bid limits, contact-access gating,
subscription state and platform settings. Unless a rule is in `database.ts` or enforced by a
Postgres view/function, assume it is only cosmetic.

:::info Docs are descriptive, not aspirational
These pages describe what the code actually does today. Where a marketing list and the enforcement
disagree, the docs call it out — see [Pricing & plans](./product/pricing-and-plans.md) for the
audit-led reconciliation of the Free/Premium jobseeker feature lists.
:::