grant select on public.support_playbook to anon, authenticated, service_role;
grant all on public.support_tickets to service_role;
grant all on public.support_log to service_role;
grant execute on function public.match_playbook(text, text) to anon, authenticated, service_role;
