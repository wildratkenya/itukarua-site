-- Expired adverts must not be switched "active" without a valid billing window.
-- An advert only serves while its billing window is open, so activating a lapse
-- lapsed advert (or inserting one already expired) is rejected. Renewing via
-- "Add Days" / M-Pesa always writes a future billing_end, so it passes.
--
-- The guard only fires when an advert is (re)activated, not on every update of
-- an already-active row, so the scheduled expiry sweep can still flip lapsed
-- actives off.

CREATE OR REPLACE FUNCTION public.enforce_advert_active_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.active, false) = true
     AND NEW.billing_end IS NOT NULL
     AND NEW.billing_end <= now()
     AND (TG_OP = 'INSERT' OR OLD.active IS DISTINCT FROM true)
  THEN
    RAISE EXCEPTION 'Cannot activate an expired advert — renew billing first';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advert_active_window ON public.advertisements;

CREATE TRIGGER trg_advert_active_window
  BEFORE INSERT OR UPDATE ON public.advertisements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_advert_active_window();
