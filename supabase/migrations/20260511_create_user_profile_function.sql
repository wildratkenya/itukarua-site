CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_location TEXT,
  p_skills TEXT,
  p_resume TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, location, skills, resume, verified, registration_paid)
  VALUES (p_id, p_full_name, p_email, p_phone, p_role, p_location, p_skills, p_resume, true, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    location = EXCLUDED.location,
    skills = EXCLUDED.skills,
    resume = EXCLUDED.resume,
    verified = true,
    registration_paid = true;
  RETURN p_id;
END;
$$;
