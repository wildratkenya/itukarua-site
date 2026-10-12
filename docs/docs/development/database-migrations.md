---
id: database-migrations
title: Database Migrations
description: Migration naming, workflow, and the full migration catalog
sidebar_label: Database Migrations
---

# Database Migrations

## Naming and workflow

Migrations live in `supabase/migrations/`, named
`YYYYMMDDHHMMSS_snake_case_description.sql` (UTC-ish timestamp + verb-first description). Keep
them **immutable and chronological** — the sequence is the schema history. Never edit an applied
migration; add a new one.

Local workflow:

```bash
supabase start
supabase db reset        # rebuild DB from migrations
supabase db diff -f new_migration_name
```

When the change is ready, apply it to the hosted project:

```bash
supabase db push --linked
```

or commit the `.sql` and let CI apply it. (The active deployment flow in this repo is
`supabase db push` for the remote project referenced by `config.toml`.)

## Catalog (25 migrations)

| Migration | What it does |
| --- | --- |
| `20260910124924_remote_schema.sql` | Baseline remote schema. |
| `20260910130000_add_profile_roles.sql` | Adds `profile_roles` (entitlements source of truth). |
| `20260910160000_maintain_jobs_bids_count.sql` | Triggers/definitions keeping jobs bid counts in sync. |
| `20260910180000_fix_job_views_counter.sql` | Fixes the job-views counter (denormalised analytics). |
| `20260910190000_billing_owner_email_backfill.sql` | Backfills billing owner email. |
| `20260911100000_jobs_featured_boost.sql` | Adds the KES 500/1-week featured boost. |
| `20260911150000_boost_renewal_notices.sql` | Notifications when a featured boost is nearing expiry. |
| `20260917120000_service_ad_analytics_social.sql` | Service-ad analytics + socials. |
| `20260917130000_corporate_billing_alerts.sql` | Corporate billing alert plumbing. |
| `20260917140000_ad_expiry_required.sql` | Ad expiration is mandatory (`ad_expires_at`). |
| `20260917150000_all_products_expiry_required.sql` | Every paid product carries an expiry. |
| `20260917160000_advert_active_guard.sql` | Guards around advert active state. |
| `20260917170000_jobs_lifecycle.sql` | Job lifecycle states (posted/awarded/completed). |
| `20260921100000_ad_corporate_slots_only.sql` | Ad placement limited to corporate slots. |
| `20260921110000_jobs_services_corporate.sql` | Corporate ownership of jobs and services. |
| `20260925100000_payment_fulfilment_plumbing.sql` | Payment fulfilment plumbing (maps payments → effects). |
| `20260925110000_ad_lifecycle_status.sql` | Ad lifecycle status flags. |
| `20260925120000_unpaid_ad_window_nullable.sql` | Unpaid ad windows nullable. |
| `20260925130000_open_homepage_banner.sql` | Opens the homepage-banner slot. |
| `20260925150000_add_service_ad_destination_url_and_boost_carousel.sql` | Destination URL + boost carousel on service ads. |
| `20260929100000_jobs_valid_until_guard.sql` | `valid_until` guard on jobs. |
| `20260929110000_contact_access_window.sql` | Introduces the contact-access window + `get_profile_contact` / `redeem_contact_token`. |
| `20261003120000_lock_down_profile_reads.sql` | **Locks down `profiles` RLS** (`profiles_select_own` + `profiles_select_admin`) and adds `public_worker_directory` view. |
| `20261006000000_admin_policies_to_authenticated.sql` | Broadens admin policies to `authenticated` where appropriate. |
| `20261010120000_jobs_awarded_bidder.sql` | Records the awarded-bidder milestone on jobs. |

## Security-relevant migrations to know by heart

- **`20261003120000`** — the day foreign contact leaks were closed. `public_worker_directory` is
  the only public projection of workers; direct `profiles` reads are owner/admin-only.
- **`20260929110000`** — establishes that contact windows are first-class constraints, not
  boolean flags.

Rule of thumb when adding a migration: if it touches who-can-see-what on `profiles`, it goes
behind a **view or RPC** (see [Data Layer](./../architecture/data-layer.md) and
[Roles & Gating](./../product/roles-and-gating.md)).