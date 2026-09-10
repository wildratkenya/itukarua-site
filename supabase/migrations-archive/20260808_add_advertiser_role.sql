-- Advertiser role: self-service banner adverts
-- Advertisers can create/manage their own advertisements (banner carousel ads).

ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Advertisers can manage (select/insert/update/delete) their own ads.
-- Inactive ads remain visible to the owner so drafts/paused ads are manageable.
DROP POLICY IF EXISTS "Advertisers can manage own ads" ON advertisements;
CREATE POLICY "Advertisers can manage own ads" ON advertisements
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'advertiser')
  );
