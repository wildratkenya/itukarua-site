-- ============================================================================
-- Migration: Profile thumbs up / down votes (likes & dislikes) with counts
-- Adds a profile_votes table + likes_count/dislikes_count on profiles,
-- plus trigger to auto-recompute counts.
-- ============================================================================

-- 1. Add count columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislikes_count INTEGER NOT NULL DEFAULT 0;

-- 2. profile_votes table (one vote per voter per profile)
CREATE TABLE IF NOT EXISTS public.profile_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(voter_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_votes_profile
  ON public.profile_votes(profile_id);

ALTER TABLE public.profile_votes ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
DROP POLICY IF EXISTS "public read profile_votes" ON public.profile_votes;
CREATE POLICY "public read profile_votes" ON public.profile_votes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "authenticated insert profile_votes" ON public.profile_votes;
CREATE POLICY "authenticated insert profile_votes" ON public.profile_votes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = voter_id);

DROP POLICY IF EXISTS "own update profile_votes" ON public.profile_votes;
CREATE POLICY "own update profile_votes" ON public.profile_votes
    FOR UPDATE USING (auth.uid() = voter_id);

DROP POLICY IF EXISTS "own delete profile_votes" ON public.profile_votes;
CREATE POLICY "own delete profile_votes" ON public.profile_votes
    FOR DELETE USING (auth.uid() = voter_id);

-- 4. Trigger function to recompute likes/dislikes counts on a profile
CREATE OR REPLACE FUNCTION public.update_profile_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
    target_id UUID;
BEGIN
    target_id := COALESCE(NEW.profile_id, OLD.profile_id);
    UPDATE public.profiles
    SET
        likes_count = COALESCE((SELECT COUNT(*) FROM public.profile_votes WHERE profile_id = target_id AND vote_type = 'up'), 0),
        dislikes_count = COALESCE((SELECT COUNT(*) FROM public.profile_votes WHERE profile_id = target_id AND vote_type = 'down'), 0)
    WHERE id = target_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_profile_vote_counts ON public.profile_votes;
CREATE TRIGGER trigger_update_profile_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON public.profile_votes
FOR EACH ROW EXECUTE FUNCTION public.update_profile_vote_counts();
