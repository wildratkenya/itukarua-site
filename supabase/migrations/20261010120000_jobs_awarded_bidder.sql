-- Records which bidder won a job so the exact job location and the poster's
-- identity can be revealed only to the successful bidder (and the poster/admin).
-- A job-level column is used because the poster cannot update another user's bid
-- under the existing bids RLS policy.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS awarded_bidder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_awarded_bidder ON public.jobs (awarded_bidder_id);
