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

ALTER TABLE public.notifications OWNER TO postgres;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self read notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "auth insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "self update notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Trigger function: notify job poster on new bid
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

-- Trigger function: notify bidder on bid accepted
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

-- Trigger function: notify message recipient
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
