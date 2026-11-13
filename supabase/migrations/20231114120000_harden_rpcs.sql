-- Harden RPC permissions: restrict get_profile_contact and redeem_contact_token
-- Revoke execute from anon and grant only to authenticated and service_role

BEGIN;

-- Revoke existing grants from anon (if any)
REVOKE EXECUTE ON FUNCTION public.get_profile_contact(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_contact_token(text) FROM anon;

-- Grant execute to authenticated and service_role only
GRANT EXECUTE ON FUNCTION public.get_profile_contact(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_contact_token(text) TO authenticated, service_role;

COMMIT;
