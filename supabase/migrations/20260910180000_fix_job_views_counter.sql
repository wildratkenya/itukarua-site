-- jobs.views was never increasing: increment_job_views is a plain plpgsql
-- function, so its UPDATE ran as the calling role and the jobs RLS policy
-- (owner/admin can update) filtered it to 0 rows for jobseekers/anon. Make it
-- SECURITY DEFINER like increment_profile_views so any viewer bumps the counter,
-- then catch the counter up with the job_views_log.
create or replace function public.increment_job_views(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs set views = coalesce(views, 0) + 1 where id = p_job_id;
end;
$$;

alter function public.increment_job_views(uuid) owner to postgres;

-- Backfill: jobs.views already carries no meaningful data, so repopulate it
-- from the actual view log.
update public.jobs j
set views = (
  select count(*)
  from public.job_views_log l
  where l.job_id = j.id
);