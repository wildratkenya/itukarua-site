begin;

-- Server-side rate limiting for unauthenticated / semi-public RPCs.
create table if not exists public.rate_limit_counters (
  bucket text not null,
  actor text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, actor, window_start)
);

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);

alter table public.rate_limit_counters enable row level security;
revoke all on table public.rate_limit_counters from anon, authenticated;
revoke all on table public.rate_limit_counters from public;

-- Identifies the caller for throttling: the authenticated user when present,
-- otherwise the first proxy-forwarded address. Never trusts client-supplied rows.
create or replace function public.request_actor()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_headers json;
  v_forwarded text;
begin
  if v_uid is not null then
    return 'user:' || v_uid::text;
  end if;
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;
  if v_headers is not null then
    v_forwarded := coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip');
    if v_forwarded is not null then
      v_forwarded := btrim(split_part(v_forwarded, ',', 1));
      if length(v_forwarded) between 1 and 64 then
        return 'ip:' || v_forwarded;
      end if;
    end if;
  end if;
  return 'anon:unknown';
end;
$$;

revoke all on function public.request_actor() from public;
revoke all on function public.request_actor() from anon, authenticated;

-- Fixed-window counter. Returns true while the caller is under the limit.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_actor text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := left(coalesce(p_actor, 'anon:unknown'), 120);
  v_window timestamptz;
  v_hits integer;
begin
  if p_bucket is null or p_limit <= 0 or p_window_seconds <= 0 then
    return false;
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_counters (bucket, actor, window_start, hits)
  values (left(p_bucket, 60), v_actor, v_window, 1)
  on conflict (bucket, actor, window_start)
  do update set hits = public.rate_limit_counters.hits + 1
  returning hits into v_hits;

  if random() < 0.02 then
    delete from public.rate_limit_counters where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from anon, authenticated;

-- Newsletter: throttle per caller and stop revealing whether an address is
-- already subscribed (the previous per-email counter was useless because the
-- unique index rejected repeats before the counter could ever reach 3).
create or replace function public.newsletter_subscribe(p_email text, p_name text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_domain text;
begin
  if v_email = ''
     or length(v_email) > 254
     or position('@' in v_email) <= 1
  then
    return 'Invalid email';
  end if;

  v_domain := substring(v_email from position('@' in v_email) + 1);
  if v_domain = ''
     or v_domain !~ '^[a-z0-9.-]+\.[a-z]{2,63}$'
     or v_domain ~* '(^|\.)(local|internal|invalid|test|example|fake)(\.|$)'
  then
    return 'Invalid email';
  end if;

  if v_email ~* '^(admin|info|support|contact|sales|helpdesk|help|office|webmaster|postmaster|hostmaster|noreply|no-reply|mailer|root|security|billing|accounts|team|hello|test|temp|mail|spam|reviews)@' then
    return 'Invalid email';
  end if;

  if v_email ~ '@([a-z0-9-]*\.)*(mailinator|guerrillamail|yopmail|temp-mail|tempmail|10minutemail|10mail|trashmail|maildrop|dispostable|throwawaymail|mailnesia|shutcmail|getnada|emailondeck|0-mail|maileater|mailcatch|mintemail|spamgourmet|fakeinbox|dropmail|mytemp|emailias|pokemail|telegmail|dumpmail|jetable|meltmail|spamfree24)\.' then
    return 'Invalid email';
  end if;

  if length(v_name) > 120 then
    v_name := left(v_name, 120);
  end if;

  if not public.consume_rate_limit('newsletter_subscribe', public.request_actor(), 10, 3600) then
    return 'Too many attempts. Please try again later.';
  end if;

  begin
    insert into public.newsletter_subscribers (email, name)
    values (v_email, v_name);
  exception when unique_violation then
    -- Deliberately silent: confirming an existing subscription is enumerable.
    return '';
  end;

  return '';
end;
$$;

alter function public.newsletter_subscribe(text, text) owner to postgres;
revoke all on function public.newsletter_subscribe(text, text) from public;
grant execute on function public.newsletter_subscribe(text, text) to anon, authenticated, service_role;

-- Contact form: validates and inserts server-side so the public INSERT policy on
-- messages can be removed. Returns '' on success, a user-facing message otherwise.
create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_message, ''));
begin
  if length(v_name) < 1 or length(v_name) > 120 then
    return 'Please provide a valid name.';
  end if;
  if length(v_email) > 254 or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$' then
    return 'Please provide a valid email address.';
  end if;
  if v_phone <> '' and (length(v_phone) > 32 or v_phone !~ '^[+0-9 ()-]{6,32}$') then
    return 'Please provide a valid phone number.';
  end if;
  if length(v_body) < 5 then
    return 'Please write a short message.';
  end if;
  if length(v_body) > 5000 then
    return 'Message is too long.';
  end if;

  if not public.consume_rate_limit('contact_message', public.request_actor(), 5, 3600) then
    return 'Too many messages. Please try again later.';
  end if;

  insert into public.messages (sender_id, sender_name, sender_email, subject, message, type, status)
  values (
    auth.uid(),
    v_name,
    v_email,
    coalesce(nullif(v_subject, ''), 'General Inquiry'),
    case when v_phone = '' then v_body else 'Phone: ' || v_phone || E'\n\n' || v_body end,
    'support',
    'unread'
  );

  return '';
end;
$$;

alter function public.submit_contact_message(text, text, text, text, text) owner to postgres;
revoke all on function public.submit_contact_message(text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text) to anon, authenticated, service_role;

-- Chat: anonymous visitors could previously INSERT straight into messages.
-- Route transcripts and user chat lines through a throttled, validated RPC.
create or replace function public.submit_chat_message(
  p_conversation_id uuid,
  p_name text,
  p_email text,
  p_message text,
  p_kind text default 'message'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_email text := left(lower(btrim(coalesce(p_email, ''))), 254);
  v_body text := btrim(coalesce(p_message, ''));
  v_kind text := coalesce(p_kind, 'message');
begin
  if p_conversation_id is null then
    return 'Invalid conversation.';
  end if;
  if v_kind not in ('message', 'transcript') then
    return 'Invalid message type.';
  end if;
  if length(v_body) < 1 or length(v_body) > 20000 then
    return 'Invalid message length.';
  end if;

  if not public.consume_rate_limit('chat_' || v_kind, public.request_actor(), 30, 3600) then
    return 'Too many messages. Please try again later.';
  end if;

  insert into public.messages (conversation_id, sender_id, sender_name, sender_email, subject, message, type, status, role)
  values (
    p_conversation_id,
    auth.uid(),
    coalesce(nullif(v_name, ''), 'Chat User'),
    coalesce(nullif(v_email, ''), 'chat@itukarua.co.ke'),
    case when v_kind = 'transcript' then 'Chat Conversation' else 'Chat Message' end,
    v_body,
    case when v_kind = 'transcript' then 'chat_transcript' else 'chat_message' end,
    'unread',
    'user'
  );

  return '';
end;
$$;

alter function public.submit_chat_message(uuid, text, text, text, text) owner to postgres;
revoke all on function public.submit_chat_message(uuid, text, text, text, text) from public;
grant execute on function public.submit_chat_message(uuid, text, text, text, text) to anon, authenticated, service_role;

-- Close the direct write path and the enumeration helper.
drop policy if exists public_insert_messages on public.messages;

revoke all on table public.messages from anon;
revoke delete, truncate, references, trigger on table public.messages from authenticated;

revoke all on function public.email_is_registered(text) from public;
revoke all on function public.email_is_registered(text) from anon, authenticated;
drop function if exists public.email_is_registered(text);

commit;
