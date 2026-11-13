-- Migration: Add unique constraint for payment idempotency
-- Guarantees that a payment can only be claimed once for a given (user_id, payment_type, related_profile_id, token).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_claim
ON public.payments (user_id, payment_type, related_profile_id, token);

COMMIT;

