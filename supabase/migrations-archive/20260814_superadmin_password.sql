-- Set the superadmin password for admin@itukarua.co.ke in auth.users
-- Run this in the Supabase Dashboard SQL Editor (or via supabase db push).
-- The password is hashed with bcrypt; it is never stored in plaintext.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET encrypted_password = crypt('P@ssword10times', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@itukarua.co.ke';

-- Ensure the profile is marked as super_admin
UPDATE public.profiles
SET role = 'super_admin',
    verified = true,
    registration_paid = true
WHERE email = 'admin@itukarua.co.ke';

-- Raise a notice if the admin user does not exist in auth
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@itukarua.co.ke') THEN
    RAISE NOTICE 'Admin user admin@itukarua.co.ke not found in auth.users - password was not changed';
  END IF;
END $$;
