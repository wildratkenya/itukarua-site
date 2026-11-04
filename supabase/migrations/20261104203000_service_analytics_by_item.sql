CREATE TABLE IF NOT EXISTS public.service_ad_views_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.service_ads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_ad_views_log_ad_created_idx
  ON public.service_ad_views_log(ad_id, created_at);

ALTER TABLE public.service_ad_views_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service owners view their analytics" ON public.service_ad_views_log;
CREATE POLICY "service owners view their analytics"
  ON public.service_ad_views_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_ads a
    WHERE a.id = service_ad_views_log.ad_id AND a.owner_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.increment_service_ad_views(p_ad_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.service_ads
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_ad_id;
  INSERT INTO public.service_ad_views_log(ad_id) VALUES (p_ad_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_service_view_history_for_ad(p_ad_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE(view_date date, view_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT l.created_at::date, count(*)::bigint
  FROM public.service_ad_views_log l
  JOIN public.service_ads a ON a.id = l.ad_id
  WHERE l.ad_id = p_ad_id
    AND a.owner_id = auth.uid()
    AND l.created_at >= now() - (p_days || ' days')::interval
  GROUP BY l.created_at::date
  ORDER BY l.created_at::date;
$$;

GRANT EXECUTE ON FUNCTION public.get_service_view_history_for_ad(uuid, integer) TO authenticated;
