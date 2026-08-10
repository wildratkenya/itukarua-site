-- Remove seeded placeholder adverts from older migrations.
-- Only targets ads still pointing at stock placeholder URLs so user-created ads are never touched.
DELETE FROM public.advertisements
WHERE image_url LIKE '%images.unsplash.com%'
   OR destination_url LIKE '%example.com%';
