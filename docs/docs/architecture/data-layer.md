---
id: data-layer
title: Data Layer & Security
description: database.ts, the Supabase client, views, RLS, RPCs and entitlements
sidebar_label: Data Layer & Security
---

# Data Layer & Security

## `src/lib/database.ts`

`database.ts` is the typed gateway to PostgREST plus the place where product rules live. It
defines:

- `Db*` interfaces (`DbProfile`, `DbJob`, `DbBid`, `DbPayment`, `DbRating`, `DbServiceAd`,
  `DbNotification`, `DbConversation`, `DbDirectMessage`, …).
- Read/write helpers for every entity (jobs, bids, ratings, profiles, service ads, payments,
  notifications, conversations, chat, subscriptions, platform settings).
- **Product constants & rules**:
  - `FREE_BID_LIMIT = 10` — the weekly free-bid ceiling.
  - `getWeeklyBidCount` / `getMonthlyBidCount` — flat counts over all bids (not per category).
  - `checkSubscriptionActive` / `getSubscriptionDaysRemaining` / `extendSubscription` — legacy
    `profiles`-based subscription helpers.
  - Entitlement helpers — `getRoleEntitlements`, `hasEntitlement`, `ensureJobseekerEntitlement`,
    `ensureAdvertiserEntitlement`, `getActiveAdvertiserTier`, `hasActiveAdvertiserSubscription`.
  - Contact-access helpers — `checkContactAccess`, `getContactAccessConfig`, `getProfileContact`.
- `notifyJobseekersOfNewJob` — fans a `new_job` notification out to **all** matching jobseekers
  (skill-category or county), Free and Premium alike, whenever a job is posted.

## Entitlements versus subscriptions

There are **two** ways a role can be "active", and the app treats them as equivalent:

1. **`profile_roles` (source of truth).** One row per `(user_id, role)` with `paid`, `expires_at`,
   `token_days`, `source`. Currently `'jobseeker' | 'employer' | 'advertiser'`. `hasEntitlement`
   checks `paid = true` and `expires_at > now`. Because this requires `paid = true`, a
   `hasEntitlement(uid, 'jobseeker')` hit *means* Premium — Free jobseekers get an
   `ensureJobseekerEntitlement` row with `paid = false`.
2. **Legacy `profiles.subscription_expires_at` + `registration_paid`.** Kept as a mirror that
   also drives the login gate and the header notice. Payment fulfilment writes both so the two
   systems never disagree.

`WorkerSearchModal`, `JobDetailPage` and `PostJobPage` combine them, e.g.:

```ts
const active = (await hasEntitlement(user.id, 'jobseeker')) || (await checkSubscriptionActive(user.id));
```

## Read security (views, RLS, RPCs)

- **`profiles` RLS is intentionally locked down.** A user may read only their own row
  (`profiles_select_own`) and admins read everything via `user_roles`
  (`profiles_select_admin`). This closes a class of endpoint leaks where `GET /profiles?select=phone,email`
  returned other users' contact data.
- **`public_worker_directory`** is a Postgres view ("card-safe worker profile projection") that
  strips phone, email, WhatsApp and resume, and excludes suspended profiles
  (`coalesce(p.suspended, false) = false`). It is granted to `authenticated` only and is the
  queryable surface for worker cards, search and home page. Suspended exclusion is enforced at
  the view layer so it cannot be bypassed by calling PostgREST directly.
- **Contact unlocks go through RPCs, never the base table:**
  - `get_profile_contact(p_profile_id)` — requires the *profile owner* to have
    `allow_contact_display = true`, and the *caller* to be the owner, an admin, or to hold a live
    employer entitlement / contact-access payment window. Returns reason codes
    (`opted_out | locked | expired | suspended | missing`) and `expiresAt`. **Suspended target
    profiles are refused** (`reason = 'suspended'`).
  - `redeem_contact_token(token)` — swaps a printed one-time token for a contact window. **A
    suspended target profile is refused** (`error = 'suspended'`).
  - `email_is_registered(email)` — signup duplicate check that returns a boolean, not the row.
- `profile_roles` grants and `user_roles` are used by admin update/delete policies so the
  subqueries do not re-enter the `profiles` policies recursively.

## Server-side enforcement (write security)

All write gates that were previously UI-only are now enforced in Postgres so they cannot be
bypassed by calling PostgREST directly:

- **Free-tier bid limit** (`FREE_BID_LIMIT = 10` per rolling 7 days) — enforced by a `BEFORE INSERT`
  trigger on `bids` raising `FREE_BID_LIMIT_REACHED` (`ERRCODE = 'P0003'`). Client-side checks
  remain UX convenience only.
- **Premium-only messaging** — `BEFORE INSERT` triggers on `conversations` and `direct_messages`
  (`enforce_messaging_entitlement`, `SECURITY DEFINER`, `search_path` pinned to `public`) raise
  `MESSAGING_ENTITLEMENT_REQUIRED` (`ERRCODE = 'P0003'`) when a non-Premium jobseeker tries to
  start a conversation or send a direct message. Employers and advertisers message freely. RLS on
  `direct_messages` additionally enforces `sender_id = auth.uid()` (anti-spoofing) and participant
  membership.
- **`audit_log`** — table `(id, user_id, action, payment_id, created_at, metadata jsonb)` with RLS
  enabled. SELECT is restricted to `profiles.role IN ('admin', 'super_admin')`; INSERT is only
  possible via `service_role` / `SECURITY DEFINER` functions (no INSERT policy for `authenticated`).
  A unique index `audit_log_payment_action_unique (payment_id, action) WHERE payment_id IS NOT NULL`
  makes duplicate entitlement grants at-most-once even when the M-Pesa callback and the reconcile
  function race. Every entitlement grant in `paymentEffects.ts` writes to `audit_log`.

## Privilege-escalation lock-down

- `profile_roles` owner `INSERT` is limited to `paid = false AND expires_at IS NULL` so a user
  cannot delete-and-re-insert a row to self-promote `paid = true`. There is no owner `UPDATE` or
  `DELETE` policy on `profile_roles`; entitlement grants are server-side only.
- `profiles` `auth_update_own_profile` `WITH CHECK` blocks self-changes to `role`,
  `subscription_expires_at`, `registration_paid`, `suspended`, `email` and `verified`. Legitimate
  self-updates (name, phone, bio, image) are untouched.

## Notifications and counters

- `notifications` rows drive the header bell and dashboard; `markNotificationRead` clears them.
- Profile views are incremented via `incrementProfileViews` (used on worker-card views), and
  analytics are read back with `trackProfileView`/`getProfileViewHistory`/`getProfileRanking`.
- Bids are counted per week/month for the Free limit (see [Roles & Gating](./../product/roles-and-gating.md)).