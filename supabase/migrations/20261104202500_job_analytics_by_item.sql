CREATE OR REPLACE FUNCTION public.get_job_view_history_for_job(p_job_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE(view_date date, view_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.created_at::date, count(*)::bigint
  FROM public.job_views_log l
  JOIN public.jobs j ON j.id = l.job_id
  WHERE l.job_id = p_job_id
    AND j.posted_by = auth.uid()
    AND l.created_at >= now() - (p_days || ' days')::interval
  GROUP BY l.created_at::date
  ORDER BY l.created_at::date;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_view_history_for_job(uuid, integer) TO authenticated;
