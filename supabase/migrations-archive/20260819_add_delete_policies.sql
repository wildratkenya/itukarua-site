-- Add missing DELETE RLS policies for jobs and service_ads.
-- Without these, RLS blocks all deletes by default.

-- JOBS: owner can delete own, super_admin can delete any
CREATE POLICY "auth_delete_jobs" ON "public"."jobs"
FOR DELETE USING (
  auth.uid() = posted_by OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  )
);

-- SERVICE_ADS: owner can delete own, super_admin can delete any
CREATE POLICY "auth_delete_service_ads" ON "public"."service_ads"
FOR DELETE USING (
  auth.uid() = owner_id OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  )
);
