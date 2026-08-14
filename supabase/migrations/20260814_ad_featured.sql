-- Add featured flag to advertisements.
-- Featured ads show in the homepage carousel; non-featured active ads show in
-- the vertical scrolling rail on the Jobs & Services pages.
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- Keep current behaviour: existing active ads stay on the homepage carousel.
-- Admin can untick "Featured" to move an ad to the side rail.
UPDATE public.advertisements SET featured = true WHERE active = true;
