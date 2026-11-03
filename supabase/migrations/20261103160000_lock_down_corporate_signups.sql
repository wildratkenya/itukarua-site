-- Corporate OTP records are only accessed by service-role edge functions.
-- Explicitly revoke the PUBLIC role as well as its browser-facing members so
-- future default grants cannot expose pending signup data.
alter table public.corporate_signups enable row level security;

revoke all on table public.corporate_signups from public;
revoke all on table public.corporate_signups from anon;
revoke all on table public.corporate_signups from authenticated;
grant all on table public.corporate_signups to service_role;
