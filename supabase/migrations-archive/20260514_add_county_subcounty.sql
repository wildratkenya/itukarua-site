-- Add county and subcounty columns to profiles, jobs, and service_ads
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subcounty text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS subcounty text;
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE service_ads ADD COLUMN IF NOT EXISTS subcounty text;

-- Recreate RPC with county/subcounty params
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_location TEXT,
  p_skills TEXT,
  p_resume TEXT,
  p_county TEXT DEFAULT NULL,
  p_subcounty TEXT DEFAULT NULL,
  p_profile_image TEXT DEFAULT NULL,
  p_ratings_enabled boolean DEFAULT NULL,
  p_terms_accepted boolean DEFAULT false,
  p_data_sharing_consent boolean DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, location, county, subcounty, skills, resume, profile_image, ratings_enabled, verified, registration_paid, terms_accepted, data_sharing_consent, accepted_terms_at)
  VALUES (p_id, p_full_name, p_email, p_phone, p_role, p_location, p_county, p_subcounty, p_skills, p_resume, COALESCE(p_profile_image, ''), COALESCE(p_ratings_enabled, false), true, true, p_terms_accepted, p_data_sharing_consent, CASE WHEN p_terms_accepted THEN now() ELSE NULL END)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    location = EXCLUDED.location,
    county = EXCLUDED.county,
    subcounty = EXCLUDED.subcounty,
    skills = EXCLUDED.skills,
    resume = EXCLUDED.resume,
    profile_image = CASE WHEN p_profile_image IS NOT NULL THEN p_profile_image ELSE profiles.profile_image END,
    ratings_enabled = CASE WHEN p_ratings_enabled IS NOT NULL THEN p_ratings_enabled ELSE profiles.ratings_enabled END,
    terms_accepted = CASE WHEN p_terms_accepted THEN true ELSE profiles.terms_accepted END,
    data_sharing_consent = CASE WHEN p_data_sharing_consent THEN true ELSE profiles.data_sharing_consent END,
    accepted_terms_at = CASE WHEN p_terms_accepted AND NOT profiles.terms_accepted THEN now() ELSE profiles.accepted_terms_at END,
    verified = true,
    registration_paid = true;
  RETURN p_id;
END;
$$;

-- Update bids_with_bidder view
CREATE OR REPLACE VIEW public.bids_with_bidder AS
SELECT b.id, b.job_id, b.bidder_id, b.price, b.proposal, b.status, b.created_at, b.updated_at,
  p.full_name AS bidder_name,
  p.profile_image AS bidder_image,
  p.rating AS bidder_rating,
  p.reviews_count AS bidder_reviews,
  p.qualifications AS bidder_qualifications,
  p.experience AS bidder_experience,
  p.skills AS bidder_skills,
  p.phone AS bidder_phone,
  p.location AS bidder_location,
  p.county AS bidder_county,
  p.subcounty AS bidder_subcounty
FROM public.bids b
LEFT JOIN public.profiles p ON b.bidder_id = p.id;
