-- Drop stale create_user_profile overloads that lack p_county/p_subcounty.
-- The canonical signature (with county/subcounty, created in
-- 20260514_add_county_subcounty.sql) stays; removing the older overloads
-- eliminates PostgREST "could not choose the best candidate function" errors
-- for callers that omit county/subcounty (defaults resolve on the remaining
-- overload).

DROP FUNCTION IF EXISTS public.create_user_profile(uuid, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_user_profile(uuid, text, text, text, text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.create_user_profile(uuid, text, text, text, text, text, text, text, text, boolean, boolean, boolean);