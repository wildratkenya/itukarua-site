-- corporate_signups could not be written by the edge functions at all (the
-- service_role had no grants on it), while anon could read OTP codes straight
-- out of PostgREST because RLS was off. Both are wrong: this table is only ever
-- touched by service-role edge functions.
alter table public.corporate_signups enable row level security;

revoke all on table public.corporate_signups from anon;
revoke all on table public.corporate_signups from authenticated;
grant all on table public.corporate_signups to service_role;
