CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

ALTER TABLE public.conversations OWNER TO postgres;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read conversation" ON public.conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = id AND user_id = auth.uid())
  );

CREATE POLICY "participants insert conversation" ON public.conversations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.conversation_participants OWNER TO postgres;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self read participants" ON public.conversation_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "auth insert participants" ON public.conversation_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.direct_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT direct_messages_pkey PRIMARY KEY (id)
);

ALTER TABLE public.direct_messages OWNER TO postgres;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read messages" ON public.direct_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = direct_messages.conversation_id AND user_id = auth.uid())
  );

CREATE POLICY "participants insert messages" ON public.direct_messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = direct_messages.conversation_id AND user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
