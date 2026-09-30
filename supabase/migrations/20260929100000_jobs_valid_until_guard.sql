-- Guard the job serving window: valid_until may only move through a sanctioned
-- reactivation (admin_reactivate_job / employer_reactivate_job RPCs) or a
-- service-role write (payment / ad-lifecycle edge functions). A plain "edit the
-- expiry date" write can therefore never silently re-activate an expired,
-- retired, or unpublished post — from the admin panel or the employer side.

-- 1) Trigger rejecting unsanctioned valid_until changes.
CREATE OR REPLACE FUNCTION public.guard_job_valid_until()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Service-role writes (payment reconciliation, lifecycle jobs) are trusted.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Sanctioned reactivation RPCs set this flag for their transaction.
  IF current_setting('app.sanctioned_job_reactivation', true) = '1' THEN
    RETURN NEW;
  END IF;
  -- No date change -> nothing to guard.
  IF NEW.valid_until IS NOT DISTINCT FROM OLD.valid_until THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'A job may only be re-activated through the sanctioned reactivation flow (admin Revive, an Employer Access subscription, or a paid listing plan).';
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_valid_until_guard ON public.jobs;
CREATE TRIGGER trg_jobs_valid_until_guard
  BEFORE UPDATE OF valid_until ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_job_valid_until();

-- 2) Admin reactivation: super_admin only.
CREATE OR REPLACE FUNCTION public.admin_reactivate_job(p_job uuid, p_days integer)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean;
  v_row public.jobs;
BEGIN
  IF p_days < 1 OR p_days > 30 THEN
    RAISE EXCEPTION 'Days must be between 1 and 30.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only a super admin can reactivate a job.';
  END IF;

  PERFORM set_config('app.sanctioned_job_reactivation', '1', true);

  UPDATE public.jobs
  SET valid_until = now() + make_interval(days => p_days),
      status = 'open',
      retired_at = NULL,
      retired_by = NULL
  WHERE id = p_job
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Job not found.';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reactivate_job(uuid, integer) TO authenticated;

-- 3) Employer reactivation, covered by an active Employer Access plan.
CREATE OR REPLACE FUNCTION public.employer_reactivate_job(p_job uuid)
RETURNS TABLE (id uuid, valid_until timestamptz, status text, granted_days integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner uuid;
  v_coverage_end timestamptz;
  v_days integer;
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

  -- Coverage end: paid employer entitlement first, profiles subscription next.
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
    RAISE EXCEPTION 'No active Employer Access. Buy a paid listing plan below or renew Employer Access (KES 200/week) to reactivate this job.';
  END IF;

  v_days := LEAST(30, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_coverage_end - now())) / 86400)::int));
  v_valid_until := LEAST(now() + make_interval(days => v_days), v_coverage_end);

  PERFORM set_config('app.sanctioned_job_reactivation', '1', true);

  UPDATE public.jobs
  SET valid_until = v_valid_until,
      status = 'open',
      retired_at = NULL,
      retired_by = NULL
  WHERE id = p_job
  RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.id, v_row.valid_until, v_row.status, v_days;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employer_reactivate_job(uuid) TO authenticated;