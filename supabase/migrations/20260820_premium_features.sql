-- Add premium feature columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Index for priority search sorting (subscribed users first)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles (subscription_expires_at DESC NULLS LAST);
