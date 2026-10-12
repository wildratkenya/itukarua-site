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
| Weekly bid cap | **Free = 10/week**, Premium = unlimited. Client-side counter over all bids (`getWeeklyBidCount`), not category-scoped. | `JobDetailPage`, `PostJobPage` |
| Message/contact employer about a job | **Premium-only** for jobseekers. | `JobDetailPage` (message CTA) |
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

## Server-side enforcement is out of scope (for now)

Several locks are UI-enforced only — the bid cap and Premium-messaging in particular. The
database offers no equivalent RLS/trigger. Before this tightens, treat `database.ts` as
authoritative product code and keep "the client shows what a user may do" honest in every new
component.

:::info Audit note
The Free/Premium audit (commit `dd4e114`) deliberately scoped fixes to **client-side** rules only,
no new migrations. Any future server-side enforcement belongs in a new migration — see
[Database migrations](./../development/database-migrations.md).
:::