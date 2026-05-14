-- Create all tables first
CREATE TABLE IF NOT EXISTS public.ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
    bidder_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    poster_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ratings_pkey PRIMARY KEY (id),
    CONSTRAINT ratings_job_bidder_unique UNIQUE (job_id, bidder_id)
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT direct_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    related_link text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- Tables created, now set ownership and RLS
ALTER TABLE public.ratings OWNER TO postgres;
ALTER TABLE public.conversations OWNER TO postgres;
ALTER TABLE public.conversation_participants OWNER TO postgres;
ALTER TABLE public.direct_messages OWNER TO postgres;
ALTER TABLE public.notifications OWNER TO postgres;

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for ratings
CREATE POLICY "public read ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "authenticated insert ratings" ON public.ratings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS policies for conversations
CREATE POLICY "participants read conversation" ON public.conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = id AND user_id = auth.uid())
  );
CREATE POLICY "participants insert conversation" ON public.conversations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS policies for conversation_participants
CREATE POLICY "self read participants" ON public.conversation_participants
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "auth insert participants" ON public.conversation_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS policies for direct_messages
CREATE POLICY "participants read messages" ON public.direct_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = direct_messages.conversation_id AND user_id = auth.uid())
  );
CREATE POLICY "participants insert messages" ON public.direct_messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = direct_messages.conversation_id AND user_id = auth.uid())
  );

-- RLS policies for notifications
CREATE POLICY "self read notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "auth insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "self update notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Realtime (using DO block to avoid errors if already added)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'direct_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

-- Trigger: new bid notification
CREATE OR REPLACE FUNCTION public.handle_new_bid_notification()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, related_link)
  SELECT j.posted_by, 'new_bid', 'New Bid Received',
    'A new bid has been placed on your job "' || j.title || '"',
    '/job/' || NEW.job_id
  FROM public.jobs j WHERE j.id = NEW.job_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_bid_insert ON public.bids;
CREATE TRIGGER on_bid_insert
  AFTER INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_bid_notification();

-- Trigger: bid accepted notification
CREATE OR REPLACE FUNCTION public.handle_bid_accepted_notification()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    INSERT INTO public.notifications (user_id, type, title, body, related_link)
    SELECT NEW.bidder_id, 'bid_accepted', 'Bid Accepted!',
      'Your bid has been accepted for job "' || j.title || '"',
      '/job/' || NEW.job_id
    FROM public.jobs j WHERE j.id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_bid_update ON public.bids;
CREATE TRIGGER on_bid_update
  AFTER UPDATE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.handle_bid_accepted_notification();

-- Trigger: new message notification
CREATE OR REPLACE FUNCTION public.handle_new_direct_message_notification()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, related_link)
  SELECT cp.user_id, 'new_message', 'New Message',
    'You have a new message',
    '/inbox'
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id != NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_direct_message_insert ON public.direct_messages;
CREATE TRIGGER on_direct_message_insert
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_direct_message_notification();
