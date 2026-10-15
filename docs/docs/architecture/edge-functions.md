---
id: edge-functions
title: Edge Functions
description: The Supabase Edge Function inventory and the _shared payment effects
sidebar_label: Edge Functions
---

# Edge Functions

A Deno Edge Function lives in `supabase/functions/<name>/index.ts`. Functions that ship user-facing
emails / SMS live alongside their HTML/SMS templates. All mutation-heavy behaviour converges on the
shared helper `supabase/functions/_shared/`.

## Shared helpers (`_shared`)

| File | Purpose |
| --- | --- |
| `cors.ts` | Standard CORS headers, shared by every function. |
| `smtp.ts` | SMTP transport helper for the email-sending functions. |
| `cronAuth.ts` | Bearer-token guard for scheduled (cron) functions. |
| `paymentEffects.ts` | **The fulfilment engine.** Idempotently applies a completed M-Pesa payment to
  the right account: jobseeker Premium (`profile_roles` + legacy mirror), employer day/week tokens,
  contact-access windows, single job posts, adverts, featured boosts. |
| `corporateBilling.ts` | Corporate subscription-tier billing / invoice helpers. |
| `corporateWelcome.ts` | Corporate-welcome email template. |

:::info Why correct payment ids matter
The M-Pesa callback arrives at `/payments/confirm` and every paid feature routes through
`paymentEffects.ts`. It exists so a retried or duplicated callback can never double-grant a
subscription — grants are conditional on the payment row's current status.
:::

## Payments & billing

| Function | Trigger | Purpose |
| --- | --- | --- |
| `mpesa-stk-push` | HTTP (from `MpesaModal`) | Initiates the STK push, records a `payments` row, returns `CheckoutRequestID`. |
| `payments-reconcile` | HTTP (app polls it) + webhook | Confirms the transaction status and applies fulfilment. |
| `issue-corporate-invoice` | HTTP (admin) | Issues a corporate invoice. |
| `corporate-monthly-billing` | cron | Runs the monthly corporate billing cycle. |
| `send-billing-invoice` | HTTP | Emails the issued invoice. |

## Corporate onboarding

| Function | Trigger | Purpose |
| --- | --- | --- |
| `create-corporate` | HTTP | Creates a corporate account. |
| `create-corporate-member` | HTTP | Adds a member to a corporate account. |
| `send-corporate-otp` | HTTP | Emails an OTP for the corporate portal. |
| `verify-corporate-otp` | HTTP | Validates the OTP and issues the corporate session. |

## Jobs & OTPs

| Function | Trigger | Purpose |
| --- | --- | --- |
| `create-user` | HTTP | Edge-side user creation (profile + auth) for out-of-band signups. |
| `delete-user` | HTTP | Edge-side user deletion. |
| `send-job-otp` | HTTP | OTP an employer uses to confirm their own job post / access their jobs. |
| `verify-job-otp` | HTTP | Validates the job OTP. |

## Email / outreach

| Function | Trigger | Purpose |
| --- | --- | --- |
| `send-contact-email` | HTTP (contact form) | Sends the contact/interest form to the site owner inbox. |
| `send-advert-lead` | HTTP | Notifies the advertiser when their advert receives a lead. |
| `send-weekly-newsletter` | cron | Weekly digest email to subscribed users. |
| `unsubscribe` | HTTP | Processes the unsubscribe (newsletter / weekly digest). |

## Cron surface

Functions guarded by `cronAuth` run on a schedule configured in `supabase/config.toml`
([`[cron]` section](https://supabase.com/docs/guides/functions/cron)): `corporate-monthly-billing`
and `send-weekly-newsletter` are the cron-driven jobs today.