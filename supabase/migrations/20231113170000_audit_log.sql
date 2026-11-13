-- Migration: Create audit_log table for entitlement actions
-- Records every grant of entitlement (contact unlock, subscription, advert boost, etc.)
-- Admins can read; other users have no access.

BEGIN;

CREATE TABLE public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  payment_id uuid REFERENCES public.payments(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

-- Enable row‑level security and allow only admins to SELECT
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_admin_read ON public.audit_log
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

COMMIT;

