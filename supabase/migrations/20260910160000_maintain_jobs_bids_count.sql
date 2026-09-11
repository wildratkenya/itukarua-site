-- jobs.bids_count is a stored counter that nothing was maintaining: bids were
-- inserted without bumping it, so every listing showing bids_count drifted from
-- the real bid count. Keep it in sync at the DB level with a trigger and then
-- correct all existing rows in a one-time backfill.
create or replace function public.sync_job_bid_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.jobs
    set bids_count = coalesce(bids_count, 0) + 1
    where id = new.job_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.jobs
    set bids_count = greatest(coalesce(bids_count, 0) - 1, 0)
    where id = old.job_id;
    return old;
  end if;
  return null;
end;
$$;

alter function public.sync_job_bid_count() owner to postgres;

drop trigger if exists trigger_sync_job_bid_count on public.bids;
create trigger trigger_sync_job_bid_count
  after insert or delete on public.bids
  for each row
  execute function public.sync_job_bid_count();

-- Backfill: match the stored counter to the actual bid rows.
update public.jobs j
set bids_count = (
  select count(*)
  from public.bids b
  where b.job_id = j.id
);