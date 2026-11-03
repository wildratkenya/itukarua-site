begin;

with duplicate_tickets as (
  select id,
         row_number() over (
           partition by conversation_id
           order by created_at asc, id asc
         ) as ticket_rank
  from public.support_tickets
  where conversation_id is not null
)
delete from public.support_tickets
where id in (
  select id from duplicate_tickets where ticket_rank > 1
);

create unique index if not exists support_tickets_one_per_conversation_idx
  on public.support_tickets (conversation_id)
  where conversation_id is not null;

commit;
