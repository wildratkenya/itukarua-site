-- Allow PDF certificates to be uploaded to the "adverts" bucket.
-- Supabase Storage rejects uploads whose MIME type is not in the bucket's
-- allowed_mime_types list. This appends application/pdf if missing (idempotent).
UPDATE storage.buckets
SET allowed_mime_types = CASE
  WHEN allowed_mime_types IS NULL THEN NULL
  WHEN NOT (allowed_mime_types @> ARRAY['application/pdf']) THEN allowed_mime_types || ARRAY['application/pdf']
  ELSE allowed_mime_types
END
WHERE id = 'adverts';