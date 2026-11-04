-- Public job feeds must hide listings whose application deadline has passed.
-- A paid subscription can revive an expired listing; its package coverage then
-- becomes the new application deadline as well as the serving window.

CREATE OR REPLACE VIEW public.platform_stats AS
SELECT
  (SELECT count(*) FROM public.jobs
   WHERE status IN ('open', 'in-progress')
     AND valid_until >= now()
     AND deadline >= current_date
     AND retired_at IS NULL) AS active_jobs,
  (SELECT count(*) FROM public.profiles
   WHERE role = 'jobseeker' AND verified = true) AS registered_workers,
  (SELECT count(*) FROM public.service_ads
   WHERE expiry_date >= current_date) AS active_businesses,
  (SELECT count(*) FROM public.jobs WHERE status = 'completed') AS completed_jobs,
  (SELECT coalesce(sum(amount), 0) FROM public.payments WHERE status = 'completed') AS total_payments,
  (SELECT count(DISTINCT location) FROM public.profiles WHERE location IS NOT NULL AND location <> '') AS counties_served;

DROP FUNCTION IF EXISTS public.employer_reactivate_job(uuid);

CREATE OR REPLACE FUNCTION public.employer_reactivate_job(p_job uuid, p_days integer DEFAULT NULL)
RETURNS TABLE (id uuid, valid_until timestamptz, status text, granted_days integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner uuid;
  v_coverage_end timestamptz;
  v_days integer;
  v_requested_days integer;
  v_valid_until timestamptz;
  v_row public.jobs;
BEGIN
  SELECT posted_by INTO v_owner FROM public.jobs WHERE id = p_job;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Job not found.';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'You can only reactivate your own jobs.';
  END IF;

  SELECT COALESCE(
    (SELECT expires_at::timestamptz FROM public.profile_roles
      WHERE user_id = v_owner AND role = 'employer' AND paid AND expires_at IS NOT NULL
      ORDER BY expires_at DESC
      LIMIT 1),
    NULL::timestamptz
  ) INTO v_coverage_end;

  IF v_coverage_end IS NULL THEN
    SELECT subscription_expires_at INTO v_coverage_end
    FROM public.profiles
    WHERE id = v_owner;
  END IF;

  IF v_coverage_end IS NULL OR v_coverage_end <= now() THEN
    RAISE EXCEPTION 'No active Employer Access. Buy a paid listing plan below or renew Employer Access to reactivate this job.';
  END IF;

  v_days := LEAST(30, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_coverage_end - now())) / 86400)::int));
  v_requested_days := COALESCE(p_days, v_days);
  IF v_requested_days < 1 THEN
    RAISE EXCEPTION 'Choose at least 1 day to reactivate this job.';
  END IF;
  IF v_requested_days > v_days THEN
    RAISE EXCEPTION 'You have % subscription day(s) remaining. Choose a shorter reactivation period or renew your subscription first.', v_days;
  END IF;
  v_days := v_requested_days;
  v_valid_until := LEAST(now() + make_interval(days => v_days), v_coverage_end);

  PERFORM set_config('app.sanctioned_job_reactivation', '1', true);

  UPDATE public.jobs
  SET valid_until = v_valid_until,
      deadline = v_valid_until::date,
      status = 'open',
      retired_at = NULL,
      retired_by = NULL
  WHERE id = p_job
  RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.id, v_row.valid_until, v_row.status, v_days;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employer_reactivate_job(uuid, integer) TO authenticated;
