-- Job-posting OTPs: stop storing codes in clear text.
--
-- The send and verify edge functions were anonymous and trusted a caller-supplied
-- user_id, the codes were generated with Math.random and stored verbatim, and
-- verification had no attempt limit. A caller could mail codes to any address,
-- then brute-force a 6-digit code with no lockout.
--
-- The functions now derive the caller from their JWT, hash the code with HMAC
-- before storing, and count failed attempts. This migration adds the storage
-- for that and invalidates every outstanding plaintext code.

begin;

alter table public.job_otps
  add column if not exists otp_hash text;

alter table public.job_otps
  add column if not exists attempts integer not null default 0;

-- Kept so the currently deployed send function keeps working until the new one
-- ships; new rows leave it null and verify never reads it.
alter table public.job_otps
  alter column otp_code drop not null;

-- Outstanding codes were stored in clear text and have no hash, so they can no
-- longer be verified. Force a fresh request.
update public.job_otps
  set used = true
  where used = false;

update public.job_otps
  set otp_code = null
  where otp_code is not null;

-- Only the edge functions (service role) touch this table. RLS already had no
-- policy for anon/authenticated, but the grants let them address it directly.
revoke all on public.job_otps from anon;
revoke all on public.job_otps from authenticated;

create index if not exists job_otps_user_active_idx
  on public.job_otps (user_id, created_at desc)
  where used = false;

commit;
