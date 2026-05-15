CREATE TABLE IF NOT EXISTS custom_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('job', 'service')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, type)
);

ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage custom categories"
  ON custom_categories
  FOR ALL
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')));
