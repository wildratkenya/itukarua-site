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

ALTER TABLE public.ratings OWNER TO postgres;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "authenticated insert ratings" ON public.ratings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
