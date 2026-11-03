begin;

create or replace function public.read_chat_conversation(p_conversation_id uuid)
returns setof public.messages
language sql
security definer
set search_path = public
stable
as $$
  select m.*
  from public.messages m
  where m.conversation_id = p_conversation_id
    and m.type in ('chat_message', 'chat_transcript')
    and m.role in ('user', 'admin')
  order by m.created_at asc;
$$;

alter function public.read_chat_conversation(uuid) owner to postgres;
revoke all on function public.read_chat_conversation(uuid) from public;
grant execute on function public.read_chat_conversation(uuid) to anon, authenticated, service_role;

commit;
