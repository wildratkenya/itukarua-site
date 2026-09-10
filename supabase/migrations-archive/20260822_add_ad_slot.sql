-- Add ad placement slot support to advertisements table
-- Run this in Supabase Dashboard SQL Editor

-- Add slot column (default 'homepage_banner' for all existing ads)
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS slot text DEFAULT 'homepage_banner';

-- Add index for efficient slot-based queries
CREATE INDEX IF NOT EXISTS idx_advertisements_slot_active ON advertisements(slot, active);

-- Ensure existing ads are tagged correctly
UPDATE advertisements SET slot = 'homepage_banner' WHERE slot IS NULL;
