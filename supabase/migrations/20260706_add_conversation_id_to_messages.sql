ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id uuid;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
