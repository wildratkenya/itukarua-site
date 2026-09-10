-- ============================================================================
-- Migration: Add profile reviews, T&C columns, and payment related_profile_id
-- ============================================================================

-- 1. profile_reviews table (text reviews with comments on worker profiles)
CREATE TABLE IF NOT EXISTS public.profile_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(reviewer_id, profile_id)
);

ALTER TABLE public.profile_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read profile_reviews" ON public.profile_reviews;
CREATE POLICY "public read profile_reviews" ON public.profile_reviews
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "authenticated insert profile_reviews" ON public.profile_reviews;
CREATE POLICY "authenticated insert profile_reviews" ON public.profile_reviews
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "own update profile_reviews" ON public.profile_reviews;
CREATE POLICY "own update profile_reviews" ON public.profile_reviews
    FOR UPDATE USING (auth.uid() = reviewer_id);

-- Function to update aggregate rating on profiles
CREATE OR REPLACE FUNCTION public.update_profile_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET 
        rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM public.profile_reviews WHERE profile_id = COALESCE(NEW.profile_id, OLD.profile_id)), 0),
        reviews_count = COALESCE((SELECT COUNT(*) FROM public.profile_reviews WHERE profile_id = COALESCE(NEW.profile_id, OLD.profile_id)), 0)
    WHERE id = COALESCE(NEW.profile_id, OLD.profile_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_profile_rating ON public.profile_reviews;
CREATE TRIGGER trigger_update_profile_rating
AFTER INSERT OR DELETE ON public.profile_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_profile_rating();


-- 2. T&C columns on profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_sharing_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;


-- 3. related_profile_id on payments (for contact_access tracking)
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS related_profile_id UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_payments_contact_access 
  ON public.payments(user_id, payment_type, related_profile_id) 
  WHERE payment_type = 'contact_access' AND status = 'completed';


-- 4. Update create_user_profile RPC with T&C params
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_location TEXT,
  p_skills TEXT,
  p_resume TEXT,
  p_profile_image TEXT DEFAULT NULL,
  p_ratings_enabled boolean DEFAULT NULL,
  p_terms_accepted boolean DEFAULT false,
  p_data_sharing_consent boolean DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, location, skills, resume, profile_image, ratings_enabled, verified, registration_paid, terms_accepted, data_sharing_consent, accepted_terms_at)
  VALUES (p_id, p_full_name, p_email, p_phone, p_role, p_location, p_skills, p_resume, COALESCE(p_profile_image, ''), COALESCE(p_ratings_enabled, false), true, true, p_terms_accepted, p_data_sharing_consent, CASE WHEN p_terms_accepted THEN now() ELSE NULL END)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    location = EXCLUDED.location,
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
