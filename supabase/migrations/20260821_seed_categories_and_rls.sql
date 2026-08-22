-- Seed all hardcoded job categories into custom_categories
INSERT INTO custom_categories (name, type) VALUES
  ('Construction', 'job'),
  ('Painting', 'job'),
  ('Plumbing', 'job'),
  ('Electrical', 'job'),
  ('Domestic Work', 'job'),
  ('Farming', 'job'),
  ('Fencing', 'job'),
  ('Landscaping', 'job'),
  ('Transport', 'job'),
  ('Carpentry', 'job'),
  ('Masonry', 'job'),
  ('Welding', 'job')
ON CONFLICT (name, type) DO NOTHING;

-- Seed all hardcoded service categories into custom_categories
INSERT INTO custom_categories (name, type) VALUES
  ('Shops', 'service'),
  ('Plumbing', 'service'),
  ('Electrical', 'service'),
  ('Salon & Beauty', 'service'),
  ('Tutoring', 'service'),
  ('Mechanics', 'service'),
  ('Catering', 'service'),
  ('Photography', 'service'),
  ('IT Services', 'service'),
  ('Cleaning', 'service'),
  ('Security', 'service')
ON CONFLICT (name, type) DO NOTHING;

-- Fix RLS: allow all authenticated users to read categories (admins can still manage)
-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage custom categories" ON custom_categories;

-- Create admin write policy
CREATE POLICY "Admins can manage custom categories"
  ON custom_categories
  FOR ALL
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')));

-- Create read policy for all authenticated users
CREATE POLICY "Authenticated users can read categories"
  ON custom_categories
  FOR SELECT
  TO authenticated
  USING (true);
