ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ratings_enabled boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_location TEXT,
  p_skills TEXT,
  p_resume TEXT,
  p_profile_image TEXT DEFAULT '',
  p_ratings_enabled boolean DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, location, skills, resume, profile_image, ratings_enabled, verified, registration_paid)
  VALUES (p_id, p_full_name, p_email, p_phone, p_role, p_location, p_skills, p_resume, p_profile_image, p_ratings_enabled, true, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    location = EXCLUDED.location,
    skills = EXCLUDED.skills,
    resume = EXCLUDED.resume,
    profile_image = EXCLUDED.profile_image,
    ratings_enabled = EXCLUDED.ratings_enabled,
    verified = true,
    registration_paid = true;
  RETURN p_id;
END;
$$;
