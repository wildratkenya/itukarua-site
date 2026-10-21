-- Expose the role that the current request carries, so an edge function can
-- recognise a service-role caller without holding the project's service key.
--
-- The project stores its service credential as the new-style secret key
-- (sb_secret_...), which is not a JWT and can never arrive in an Authorization
-- header. The cron workflows, on the other hand, hold the legacy service-role
-- JWT. Comparing the two as strings therefore rejects a genuine service caller.
--
-- PostgREST already verifies the bearer token's signature against the project
-- before the request reaches the database, so auth.role() is only ever the role
-- of a token that passed that check. An invalid, expired or unsigned token
-- never gets here at all — the request is rejected at the gateway.
--
-- The function reveals nothing but the caller's own role.

create or replace function public.current_jwt_role()
returns text
language sql
stable
as $$
  select coalesce(auth.role(), '');
$$;

revoke all on function public.current_jwt_role() from public;
grant execute on function public.current_jwt_role() to anon, authenticated, service_role;
