---
id: roles-and-gating
title: Roles & Gating
description: Roles, entitlements, subscription state, and every gate that decides who can do what
sidebar_label: Roles & Gating
---

# Roles & Gating

## Roles

Roles are stored in **`profile_roles`** (`user_id, role, paid, expires_at, token_days, source`)
and mirrored onto `profiles.subscription_expires_at` / `profiles.registration_paid` for the login
gate and header notice. The graph of entitlements:

```
jobseeker  → ensureJobseekerEntitlement    (premium depth: paid, expires_at)
employer   → ensureAdvertiserEntitlement?  (no — employer lives on profile_roles 'employer')
advertiser → ensureAdvertiserEntitlement   (tier: Bronze/Silver/Gold, Advertiser) + subscription
admin      → user_roles ('admin')          (drives AdminDashboardPage)
corporate  → administered via Supabase + corporate edge functions (members have their own roles)
```

The practical definition of "active": `hasEntitlement(user_id, role)` (paid + unexpired) **or**
`checkSubscriptionActive(user_id)` (legacy mirror). UI helpers combine both, e.g.:

```ts
const active = (await hasEntitlement(user.id, 'jobseeker')) || (await checkSubscriptionActive(user.id));
```

Because `hasEntitlement('jobseeker')` requires `paid = true`, a hit means **Premium**; the
Free-tier fallback is `ensureJobseekerEntitlement` with `paid = false`.

## Registration gate

Signups ask for role at register time (`AuthModal`). Post-signup payment gating then applies:

- **Jobseekers** land on the Free / KES 100 plan chooser.
- **Employers** land on the Employer Access / Single Job Token / Decide Later chooser.
- **Advertisers** land on the advertiser subscription guard (a live subscription gates the
  Advertise page).
- `withMpesaGate(profile, onOpenMpesa, onOpenAuth)` and the `pendingPayments` flow hold
  non-paying users at the paywall until a payment completes — the M-Pesa state machine never lets
  a `pending` payment silently vanish.

Without a completed payment the user can browse public pages, but Premium features are locked.

## Gated capabilities

| Capability | Gate | Where |
| --- | --- | --- |
| Weekly bid cap | **Free = 10/week**, Premium = unlimited. Enforced server-side by a `BEFORE INSERT` trigger on
| `bids` raising `FREE_BID_LIMIT_REACHED` (`ERRCODE = 'P0003'`). Client-side counter (`getWeeklyBidCount`)
| is UX convenience only; the DB is the source of truth. | `JobDetailPage`, `PostJobPage` |
| Message/contact employer about a job | **Premium-only** for jobseekers. Enforced server-side by `BEFORE INSERT` triggers on
| `conversations` and `direct_messages` raising `MESSAGING_ENTITLEMENT_REQUIRED` (`ERRCODE = 'P0003'`).
| Employers and advertisers message freely. `direct_messages` RLS enforces `sender_id = auth.uid()`
| (anti-spoofing) + participant membership. | `JobDetailPage` (message CTA), `InboxPage` (send) |
| See/preview a bidder's profile + contact | `profiles_select_own` blocks direct row reads; foreign reads go through `public_worker_directory`. Contact data only via `get_profile_contact` / `redeem_contact_token` | `WorkerSearchModal`, `JobDetailPage`, `TopRatedWorkersModal` |
| Employer contact unlock | `contact_access` window must exist | `getContactAccessConfig`, `checkContactAccess` |
| Employer unlimited post/week | `profile_roles 'employer'` active with token_days/week | `PostJobPage` |
| Advertiser tools | Live advertiser subscription + active tier | `AdvertisePage`, `PostAdvertPage` |
| Ratings on jobs | **Only when the bidder has `ratings_enabled = true`** — via `getProfileRatingsFlag` (reads the `WORKER_DIRECTORY` view, because base-table RLS blocks foreign rows) | `JobDetailPage` (`openRatingModal`, `handleRateWorker`) |
| Worker contact display | Profile owner `allow_contact_display = true`, else RPC returns `opted_out` | `get_profile_contact` |
| Admin | `user_roles` contains `'admin'` | `AdminDashboardPage` |
| Corporate portal | Corporate OTP session (send/verify-corporate-otp) | Corporate pages |

## Featured badge

`isPremiumOrFeatured(p)` (`src/lib/utils.ts`):

```ts
export const isPremiumOrFeatured = (p) =>
  isAdminFeatured(p) || isPremium(p); // is_featured OR live subscription_expires_at
```

Used in `HomePage`, `WorkerSearchModal` and `TopRatedWorkersModal` so live Premium subscribers
show the featured-style badge.

## Server-side enforcement

The following gates are enforced in Postgres, not just the UI. They cannot be bypassed by calling
PostgREST directly:

| Gate | Enforcement | Server-side error |
| --- | --- | --- |
| Free-tier bid cap (10/rolling 7 days) | `BEFORE INSERT` trigger on `bids` | `FREE_BID_LIMIT_REACHED` (`ERRCODE = 'P0003'`) |
| Premium-only messaging (jobseeker sends) | `BEFORE INSERT` trigger on `conversations` + `direct_messages` | `MESSAGING_ENTITLEMENT_REQUIRED` (`ERRCODE = 'P0003'`) |
| Message sender anti-spoofing | `direct_messages` RLS `WITH CHECK sender_id = auth.uid()` | RLS `42501` |
| Suspended worker excluded from directory | `public_worker_directory` view `coalesce(p.suspended, false) = false` | (row absent) |
| Contact unlock refused for suspended target | `get_profile_contact` / `redeem_contact_token` RPCs | `reason = 'suspended'` / `error = 'suspended'` |

Client-side checks (`getWeeklyBidCount`, `checkSubscriptionActive`, `hasEntitlement`) remain as UX
convenience only; the database is the source of truth. Frontend code maps the server error codes to
the Premium upgrade flow (`onOpenMpesa` with account ref `PREM-NEW`) and the bid-limit upsell.

## SPA routes

The app is a single-page application with React Router handling three real routes (`/`,
`/advertise`, `/admin`) and internal pages switched inside `AppLayout`. The navigable pages are:

| Route | Page | Gate |
| --- | --- | --- |
| `/` | Home | Public |
| `/jobs` | Jobs listing | Public |
| `/jobs/:id` | Job detail | Public to view; Premium to message/apply |
| `/services` | Services / adverts | Public |
| `/services/:id` | Service detail | Public |
| `/pricing` | Pricing | Public |
| `/about` | About | Public |
| `/contact` | Contact | Public |
| `/corporate` | Corporate portal | Corporate OTP session |
| `/dashboard` | Dashboard | Authenticated (role-aware tabs) |
| `/inbox` | Inbox / direct messages | Authenticated; Premium to send as jobseeker |
| `/post-job` | Post job | Employer entitlement |
| `/post-advert` | Post advert | Advertiser subscription |
| `/advertise` | Advertise landing | Public |
| `/admin` | Admin dashboard | `user_roles.role = 'admin'` |

Pages navigate via `onNavigate(page)`; `AppLayout` renders the matching component and hosts the
auth modal (`AuthModal`), M-Pesa payment modal (`MpesaModal`), chatbot, and post-signup payment gate.

The discriminated `Page` union (defined in `Header.tsx`):

```ts
export type Page =
  | 'home' | 'jobs' | 'services' | 'pricing' | 'about' | 'contact'
  | 'dashboard' | 'inbox' | 'job-detail' | 'service-detail'
  | 'post-job' | 'post-advert' | 'advertise' | 'admin'
  | 'corporate' | 'corporate-signup';
```