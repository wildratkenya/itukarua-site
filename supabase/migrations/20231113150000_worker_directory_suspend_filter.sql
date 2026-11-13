-- Migration: Exclude suspended users from public_worker_directory view
-- Recreates the view with a WHERE clause filtering out suspended profiles.

BEGIN;

DROP VIEW IF EXISTS public.public_worker_directory CASCADE;

CREATE VIEW public.public_worker_directory AS
SELECT
  p.id,
  p.full_name,
  p.profile_image,
  p.rating,
  p.reviews_count,
  p.skills,
  p.qualifications,
  p.experience,
  p.certificates,
  p.location,
  p.county,
  p.subcounty,
  p.role,
  p.verified,
  p.created_at,
  p.updated_at,
  p.likes_count,
  p.dislikes_count,
  p.profile_views,
  p.is_featured,
  p.ratings_enabled,
  p.registration_paid,
  p.subscription_expires_at,
  p.terms_accepted,
  p.data_sharing_consent,
  p.accepted_terms_at,
  p.suspended,
  p.allow_contact_display
FROM public.profiles p
WHERE p.suspended = false;

COMMENT ON VIEW public.public_worker_directory IS
  'Card-safe worker profile projection. No phone, email, whatsapp_number or resume. Contact access is gated by get_profile_contact. Excludes suspended users.';

COMMIT;
