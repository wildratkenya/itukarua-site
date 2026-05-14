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
  p_ratings_enabled boolean DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, location, skills, resume, profile_image, ratings_enabled, verified, registration_paid)
  VALUES (p_id, p_full_name, p_email, p_phone, p_role, p_location, p_skills, p_resume, COALESCE(p_profile_image, ''), COALESCE(p_ratings_enabled, false), true, true)
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
    verified = true,
    registration_paid = true;
  RETURN p_id;
END;
$$;
