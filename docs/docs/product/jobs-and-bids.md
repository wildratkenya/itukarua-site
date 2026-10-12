---
id: jobs-and-bids
title: Jobs & Bids Lifecycle
description: From job creation to awarding, completion and rating
sidebar_label: Jobs & Bids
---

# Jobs & Bids Lifecycle

## Posting a job

1. `PostJobPage` collects details (title, category, county, pay, description). For posting users,
   employers are gated by their plan; jobseekers cannot post outside their plan terms.
2. `createJob` (`database.ts`) inserts the job and records `jobs_awarded_bidder` milestones when
   relevant.
3. `notifyJobseekersOfNewJob` fans a **`new_job`** notification out to all matching jobseekers —
   by skill category and/or county — regardless of Free/Premium (recent audit removed the
   Premium-only filter).
4. The job appears under **"Posted by: verified employer"** only when the poster holds the
   relevant employer entitlement; public jobs list (Home/Jobs page) surfaces it via `JobListCard`.

## Bidding

- Only **jobseekers** place bids (`placeBid`). Each bid records the job id, the bidder, a message,
  price and availability.
- **Free**: max **10 bids per week** (rolling week, all categories). **Premium**: unlimited.
- The UI enforces the cap when the CTA is tapped. `JobDetailPage` shows the bidder list, sorts by
  price/timeline, and lets the owner **award** a bidder.

## Awarding, completion and rating

| Step | Signal | Table/effect |
| --- | --- | --- |
| Owner awards a bidder | `awardBid` | Job marked awarded; bidder recorded. |
| Owner marks complete | job completion | Job → completed; notifications created. |
| Owner rates a worker | **Only allowed if that bidder has `ratings_enabled = true`.** | `handleRateWorker` blocked otherwise — `getProfileRatingsFlag` gates the rating modal too. |
| Anonymous/shared "I referred this job" | — | `JobReferral` UI in job detail. |

:::tip Why the ratings gate exists
The "player one" abuse case: a job owner who unlocks a worker's profile just to rate them
negatively without any employer verification. `ratings_enabled` is a worker-side opt-in, so a
worker who never opts in cannot be rated through a job's UI.
:::

## Jobs, adverts and listings

- `jobs` and `service_ads` (adverts) are separate tables. Jobs are posted items; `service_ads`
  are advertiser campaigns shown in the Services grid (`ServiceAdGrid`) and on the Advertise page.
- Public directory search (`WorkerSearchModal`) reads the **`public_worker_directory`** view.
- `JobDetailPage` job OTPs let a non-logged-in owner verify access to their own posting
  (`send-job-otp` / `verify-job-otp`).