-- Admin "Add days" must also move a lapsed application deadline.
--
-- The revive used to set only valid_until (the paid serving window), so a job
-- whose deadline had lapsed came back open with the stale deadline still on the
-- row. boost-expire retires any open job whose deadline is more than 14 days
-- old, so the revived ad was retired again on the next cron run — one day later
-- — while its paid days were still running.
--
-- A revived ad is meant to be live and accepting applications, so a lapsed
-- deadline moves to the new end of the window. A deadline still in the future is
-- left exactly as the employer set it.

create or replace function public.admin_reactivate_job(p_job uuid, p_days integer)
returns public.jobs
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_admin boolean;
  v_row public.jobs;
  v_end timestamptz;
begin
  if p_days < 1 or p_days > 30 then
    raise exception 'Days must be between 1 and 30.';
  end if;

  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  ) into v_is_admin;
  if not v_is_admin then
    raise exception 'Only a super admin can reactivate a job.';
  end if;

  perform set_config('app.sanctioned_job_reactivation', '1', true);

  v_end := now() + make_interval(days => p_days);

  update public.jobs
  set valid_until = v_end,
      status = 'open',
      retired_at = null,
      retired_by = null,
      deadline = case
        when deadline is not null and deadline < current_date then v_end::date
        else deadline
      end
  where id = p_job
  returning * into v_row;

  if v_row is null then
    raise exception 'Job not found.';
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_reactivate_job(uuid, integer) to authenticated;
