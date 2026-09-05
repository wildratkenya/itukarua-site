-- Ensure every column the app writes to public.profiles exists (idempotent).
-- Safe to run multiple times. Fixes PostgREST 400 (unknown column) on profile save.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certificates text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subcounty text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ratings_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_sharing_consent boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_views integer DEFAULT 0;