---
id: contact-and-messaging
title: Contact & Messaging
description: Contact unlocks, privacy flags, direct messages and notifications
sidebar_label: Contact & Messaging
---

# Contact & Messaging

## Contact unlocks (the payment-gated path)

Contract details **never leave the base `profiles` table**. There are exactly three supported ways
to see a worker's phone/email/WhatsApp:

1. **Employer entitlement / access window** — a weekly or daily plan (`employer_day_access`) or
   `contact_access` payment type gives a contact window; email/SMS notifications confirm the
   unlock. Window end is exposed via `getContactAccessConfig`/`getProfileContact.reason`.
2. **One-time contact token** — `redeem_contact_token` swaps a printed token for a short window.
3. **Own profile / admin** — the row owner via RLS, or an `admin` (`profiles_select_admin`).

Everything else is denied. A caller without the above gets `reason = 'locked' | 'expired' |
'opted_out' | 'missing'` and no contact data. Users without `allow_contact_display = true` are
treated as `opted_out` no matter their entitlement (that privacy opt-out is respected first).

## On-site chat

- Row-level conversations via `conversations` + `direct_messages`, paginated with
  `getConversations` / `getDirectMessages`.
- **Jobseekers messaging an employer about a job is Premium-only** (audited gate in
  `JobDetailPage`). Employer→jobseeker outreach is fine under an employer entitlement.
- The chat UI (`InboxPage`) shows unread counts; new messages create notification rows.

## Notifications

- `notifications` rows drive the header bell and dashboard list:
  `new_job` (all matching jobseekers), bid received, job awarded, job completed, message,
  advertiser lead, system.
- `markNotificationRead` acknowledges one or all.

## Contact form / external email

- The Contact page POSTs to `send-contact-email` (Edge Function) which delivers the message via
  SMTP to the site-inbox — it does not write a chat row.
- Advertiser-interest and order-inquiries on `PostAdvertPage` use the same pattern
  (`send-advert-lead` → advertiser inbox; newsletter digests via `send-weekly-newsletter`;
  unsubscribes via `unsubscribe`).