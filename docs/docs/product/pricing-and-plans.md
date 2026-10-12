---
id: pricing-and-plans
title: Pricing & Plans
description: Every tier and price, with the audit reconciliation of "what the site says" vs "what the code enforces"
sidebar_label: Pricing & Plans
---

# Pricing & Plans

The **source of truth is `src/data/siteData.ts`**. Prices below are what the site presents today
(KES). After a full Free-vs-Premium audit (commit `dd4e114`), the plan copy and feature-matrices
were brought in line with what the code actually enforces.

## Jobseekers

| Plan | Price | Enforced features |
| --- | --- | --- |
| **Free** | KES 0 | Register; browse jobs; **10 job bids per week** (`FREE_BID_LIMIT = 10`, window = rolling week); receive `new_job` notifications like everyone else; appears in the public worker directory. |
| **Premium** | **KES 100 / month** | **Unlimited job bids**; contact-in/from-employers (see gating); priority placement / stronger profile-signal helpers (`getProfileRatingsFlag`); featured badge **if live on `subscription_expires_at`** (`isPremiumOrFeatured`). |

Key legacy payment rows for jobseekers:

| Payment `payment_type` | Account ref | Effect after success |
| --- | --- | --- |
| `registration` | `PREM-NEW` (jesekeeper Premium) | 30 days Premium via `profile_roles` + `profiles.subscription_expires_at` |
| `registration` | `ADV-SUB` | Advertiser subscription |
| `employer_day_token` | `TOKEN-<day>` | Daily employer token(s) |
| `employer_day_access` | daily access | Day-access window |
| `contact_access` | — | Contact-unlock window for one worker |
| `single_job_post` | — | One job post |
| `advert` | — | Advert campaign |

## Employers

| Plan | Price | What it grants |
| --- | --- | --- |
| **Employer Access (subscription)** | **KES 200 / week** | Unlimited contact unlocks & job posts for the week (via employer entitlement + `contact_access` windows). |
| **Single Job Access** | **KES 100 / 1 day** | One job post with a 1-day contact window. |
| **One-time contact token** | printed/redeemable | Redeemable to view one worker's contact (`redeem_contact_token`). |

Employer payment type `employer_day_access` with account refs `TOKEN-<daily token>` vs `WEEK-<token>`
maps to the 1-day window; the weekly subscription writes `profile_roles` for `employer`.

## Adverts & boosts

| Product | Price | Period |
| --- | --- | --- |
| Advert (small) | KES 300 | 10 days |
| Advert (medium) | KES 500 | 20 days |
| Advert (large) | KES 800 | 30 days |
| **Featured Boost** | KES 500 | 1 week |

Advert slots are set via `advertiser_tiers`; the app picks the 3-tier picker in
`PostAdvertPage` and shows adverts through `ServiceAdGrid`. **Featured** badges on jobseekers are
applied by `isPremiumOrFeatured` (admin `is_featured` **or** live `subscription_expires_at`).

## Corporate tiers

| Tier | Description |
| --- | --- |
| **Bronze / Silver / Gold** | Standard packages with different slot counts |
| **Custom** | Bespoke packages |

Corporate "slots" are purchased per placement:

| Placement | Meaning |
| --- | --- |
| `sitewide_strip` | Site-wide sponsor strip |
| `category_strip` | Category strip sponsorship |
| `homepage_banner` | Homepage banner |

Corporate accounts onboard through the corporate functions
([Edge Functions](./../architecture/edge-functions.md)), are invoiced via
`issue-corporate-invoice` and billed monthly by `corporate-monthly-billing`.

:::note Audit finding: "in your category"
Older marketing said the Free tier gets "10 job bids per week *in your category*". The code counts
**all** bids, not category-scoped. The copy (in `siteData.ts` and `PricingPage`) now reads "10 job
bids per week" without the category qualifier.
:::

## Where each price is used

- Purchase buttons → `MpesaModal` with `paymentType` + `accountRef` from `siteData.ts`.
- Feature matrices → `PRICING_PLANS.employer` (weekly vs single-day) and `PRICING_PLANS.jobseeker`
  in `siteData.ts`, rendered by `MpesaModal` / `PricingPage`.
- Change logs/detail lines → `DashboardPage` payments table.