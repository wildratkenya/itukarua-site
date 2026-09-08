-- Custom corporate bundles are composed from the shared corporate features
-- catalog (slots + capabilities + team). NULL/absent means the account uses its
-- tier's defaults; a stored value (custom only) overrides the fixed set.

ALTER TABLE public.corporate_accounts ADD COLUMN IF NOT EXISTS features jsonb;

COMMENT ON COLUMN public.corporate_accounts.features IS
  'Custom bundle: { ids: string[], placements: int, team_seats: int }. NULL = fixed tier defaults.';