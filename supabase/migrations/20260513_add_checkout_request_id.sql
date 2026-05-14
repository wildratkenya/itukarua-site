ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_checkout_request ON payments(checkout_request_id);
