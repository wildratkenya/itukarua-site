ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS cta_text text DEFAULT 'Learn More';
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS clicks integer DEFAULT 0;
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS display_count integer DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_ad_click(ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE advertisements SET clicks = clicks + 1 WHERE id = ad_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_ad_display(ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE advertisements SET display_count = display_count + 1 WHERE id = ad_id;
END;
$$;
