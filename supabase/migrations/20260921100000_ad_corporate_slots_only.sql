-- Corporate-only advertising slots.
-- The corporate placement slots (sitewide_strip, category_strip, homepage_banner,
-- job_listings_top) must only serve adverts tied to a corporate account/tier, so that
-- what appears on the corporate strip / carousel / top banner always matches
-- /admin Corporate. This migration:
--   1) force-pauses any currently-served orphaned advert in those slots
--   2) enforces the invariant going forward.

UPDATE "public"."advertisements"
SET "active" = false,
    "featured" = false,
    "boost_until" = NULL
WHERE "slot" IN ('sitewide_strip', 'category_strip', 'homepage_banner', 'job_listings_top')
  AND "corporate_account_id" IS NULL
  AND "corporate_tier" IS NULL
  AND "active" = true;

ALTER TABLE "public"."advertisements"
  DROP CONSTRAINT IF EXISTS "advertisements_corporate_slots_require_account";

-- Gate only SERVING rows: an active advert in a corporate slot must be linked to
-- a corporate account/tier. Inactive orphans (already force-paused above or never
-- served) do not serve, so they may remain for admin cleanup via the Ungated card.
ALTER TABLE "public"."advertisements"
  ADD CONSTRAINT "advertisements_corporate_slots_require_account"
  CHECK (
    "active" = false
    OR "slot" NOT IN ('sitewide_strip', 'category_strip', 'homepage_banner', 'job_listings_top')
    OR "corporate_account_id" IS NOT NULL
    OR "corporate_tier" IS NOT NULL
  );