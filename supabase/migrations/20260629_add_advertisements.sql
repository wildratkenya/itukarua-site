CREATE TABLE IF NOT EXISTS advertisements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  image_url text NOT NULL,
  destination_url text NOT NULL,
  is_affiliate boolean DEFAULT false,
  active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active ads" ON advertisements
  FOR SELECT USING (active = true);

CREATE POLICY "Admins can manage ads" ON advertisements
  USING (auth.jwt() ->> 'role' = 'super_admin');
