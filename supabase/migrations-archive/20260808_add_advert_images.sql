-- Banner adverts support a gallery of up to 3 images.
-- The first image (image_url) is the main banner tile; all images show in the homepage popup.

ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
