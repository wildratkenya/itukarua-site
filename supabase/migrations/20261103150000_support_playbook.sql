create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create table if not exists public.support_playbook (
  id text primary key,
  category text not null,
  audience text[] not null default '{all}',
  title text not null,
  keywords text not null,
  answer text not null,
  action text,
  escalate boolean not null default false,
  updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector('simple', title || ' ' || keywords)
  ) stored
);

create index if not exists support_playbook_fts_idx
  on public.support_playbook using gin (fts);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  email text,
  category text not null,
  priority text not null default 'P3' check (priority in ('P1', 'P2', 'P3')),
  message text not null,
  transcript jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  created_at timestamptz not null default now(),
  first_response_at timestamptz
);

create table if not exists public.support_log (
  id bigint generated always as identity primary key,
  requester_key text,
  q text not null,
  matched_id text references public.support_playbook(id) on delete set null,
  score real,
  outcome text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_log_rate_limit_idx
  on public.support_log (requester_key, created_at);

alter table public.support_playbook enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_log enable row level security;

drop policy if exists "support playbook is public" on public.support_playbook;
create policy "support playbook is public"
  on public.support_playbook for select using (true);

create or replace function public.match_playbook(q text, aud text)
returns table (
  id text,
  title text,
  answer text,
  action text,
  escalate boolean,
  score real
)
language sql
stable
security invoker
set search_path = public
as $$
  with query as (
    select plainto_tsquery('simple', left(coalesce(q, ''), 500)) as tsq
  )
  select p.id,
         p.title,
         p.answer,
         p.action,
         p.escalate,
         (
           ts_rank(p.fts, query.tsq)
           + similarity(lower(p.title || ' ' || p.keywords), lower(left(q, 500)))
         )::real as score
  from public.support_playbook p
  cross join query
  where aud = 'all' or aud = any(p.audience) or 'all' = any(p.audience)
  order by score desc
  limit 3
$$;

insert into public.support_playbook
  (id, category, audience, title, keywords, answer, action, escalate)
values
  ('PAY-1', 'payments', '{all}', 'M-Pesa prompt did not appear',
   'stk push mpesa prompt haijaonekana phone number registered retry',
   'Check that your phone is on and the number is registered for M-Pesa. Retry once, then wait for the prompt to time out before trying again. We escalate after two failed attempts.',
   null, false),
  ('PAY-2', 'payments', '{all}', 'Paid but access was not applied',
   'paid payment money deducted no access subscription premium unlock missing mpesa',
   'I can re-check your latest pending payment. Refresh in a minute; if access is still missing after 15 minutes, contact support with the M-Pesa confirmation code.',
   'check_payment', false),
  ('PAY-3', 'payments', '{all}', 'Paid twice',
   'double payment charged twice paid two times refund mpesa',
   'Please send both M-Pesa confirmation codes. Double-payment cases are reviewed by our team; the assistant cannot promise a refund.',
   null, true),
  ('PAY-4', 'payments', '{all}', 'Payment cancelled or failed',
   'cancelled wrong pin insufficient funds failed payment retry',
   'A cancelled, incorrect-PIN, or insufficient-funds payment does not create access. Confirm your balance and M-Pesa PIN, then retry from the plan or checkout page.',
   null, false),
  ('PAY-5', 'payments', '{all}', 'Find a payment receipt',
   'receipt payment history transaction dashboard',
   'Open your Dashboard and check the Payments table for your transaction and M-Pesa reference.',
   null, false),
  ('PLAN-1', 'plans', '{jobseeker}', 'Free and Premium plans',
   'free premium price cost bids weekly unlimited messaging featured badge',
   'Free costs KES 0 and includes 10 bids per rolling week across all categories. Premium costs KES 100 for 30 days, includes unlimited bids, lets jobseekers message employers, and includes a featured badge.',
   null, false),
  ('PLAN-2', 'plans', '{jobseeker}', 'Weekly bid limit',
   'bid limit cap ten 10 week rolling calendar',
   'The Free plan allows 10 bids in a rolling week, not a calendar week. Premium removes the bid cap.',
   null, false),
  ('PLAN-3', 'plans', '{employer}', 'Employer plans',
   'employer access single job access unlock posts price cost',
   'Employer Access costs KES 200 per week and includes unlimited unlocks and posts. Single Job Access costs KES 100 per day.',
   null, false),
  ('PLAN-4', 'plans', '{jobseeker}', 'Premium expiry',
   'premium expired renew expiry date 30 days',
   'Premium is a 30-day window and does not renew automatically. Renew it from the plan chooser in your Dashboard.',
   'check_plan', false),
  ('PLAN-5', 'plans', '{advertiser}', 'Advert and boost prices',
   'advert advertising boost small medium large featured price days',
   'Small is KES 300 for 10 days, Medium is KES 500 for 20 days, Large is KES 800 for 30 days, and Featured Boost is KES 500 per week.',
   null, false),
  ('PLAN-6', 'plans', '{advertiser}', 'Corporate advertising',
   'corporate bronze silver gold custom placement company quote',
   'Please share your company, contact details, and preferred placement with the team. Corporate Bronze, Silver, Gold, and Custom plans are handled by a human.',
   null, true),
  ('CON-1', 'contact', '{employer,jobseeker}', 'Viewing a worker contact',
   'phone email contact worker unlock access token',
   'There are only three routes to a worker contact: an active employer access window, a one-time contact token, or your own profile. The assistant never reveals contact details.',
   null, false),
  ('CON-2', 'contact', '{employer,jobseeker}', 'Contact is locked or unavailable',
   'contact locked expired opted out privacy',
   'Locked means an access route is not active, expired means its window ended, and opted out means the worker turned off contact display. No plan overrides an opt-out.',
   null, false),
  ('CON-3', 'contact', '{jobseeker}', 'Messaging an employer',
   'message employer contact premium jobseeker',
   'Messaging employers about a job is a Premium-only feature for jobseekers.',
   null, false),
  ('CON-4', 'contact', '{all}', 'Redeem a contact token',
   'redeem token contact code voucher',
   'Open the contact-token redemption option in your Dashboard, enter the token exactly as issued, and submit it. If it fails, send the error and token ID to support; do not share a worker phone number here.',
   null, false),
  ('JOB-1', 'jobs', '{employer}', 'Post a job',
   'post job employer active plan title category county pay description',
   'Posting a job needs an active employer plan. Have the title, category, county, pay, and description ready, then choose Post a Job from the menu.',
   null, false),
  ('JOB-2', 'jobs', '{jobseeker,employer}', 'Job alerts',
   'job alert notification not receiving category county',
   'Alerts match your selected skill category and/or county. This is available to Free and Premium users; check that your profile preferences are complete.',
   null, false),
  ('JOB-3', 'jobs', '{employer,jobseeker}', 'Award, complete, and rate a job',
   'award complete job rating review',
   'The job owner awards and completes the job. Rating is available only when the worker has enabled ratings.',
   null, false),
  ('JOB-4', 'jobs', '{employer,jobseeker}', 'Cannot rate a worker',
   'rate worker ratings disabled opt in',
   'The worker has not opted in to ratings. They must enable ratings before a rating can be submitted.',
   null, false),
  ('JOB-5', 'jobs', '{employer}', 'Verify a posting without logging in',
   'verify posting otp job one time password',
   'Use the job OTP flow from the verification link. If the OTP does not arrive after a resend, contact support with the job reference.',
   null, true),
  ('ACC-1', 'account', '{all}', 'Login or OTP problem',
   'login sign in otp email spam resend',
   'Check your spam folder, confirm the email address, and resend the OTP. We escalate after two unsuccessful attempts.',
   null, false),
  ('ACC-2', 'account', '{all}', 'Delete account or data',
   'delete account data erase privacy removal',
   'Account and data deletion is handled by a human after an identity check. Contact support using the Contact page.',
   null, true),
  ('ACC-3', 'account', '{all}', 'Unsubscribe from email',
   'unsubscribe newsletter email stop',
   'Use the unsubscribe link at the bottom of the newsletter email.',
   null, false),
  ('SAF-1', 'safety', '{all}', 'Report a scam or abusive user',
   'scam fraud abuse harassment unsafe report',
   'Please send the job or profile link and describe what happened. Safety reports are handled by a human as a priority.',
   null, true),
  ('SAF-2', 'safety', '{all}', 'Refund request',
   'refund reimbursement money back dispute',
   'Refund requests are handled by a human. Send the payment reference and a short explanation through the Contact page.',
   null, true)
on conflict (id) do update set
  category = excluded.category,
  audience = excluded.audience,
  title = excluded.title,
  keywords = excluded.keywords,
  answer = excluded.answer,
  action = excluded.action,
  escalate = excluded.escalate,
  updated_at = now();
