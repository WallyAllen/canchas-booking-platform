-- Migration 014: Secure bookings table against unauthorized modifications (SEC-02)

CREATE OR REPLACE FUNCTION public.protect_booking_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow bypassing if it's the service_role
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow bypassing if the user is a platform admin
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  
  -- Allow bypassing if the user is the owner of the venue
  IF EXISTS (
      SELECT 1 FROM public.courts c
      JOIN public.venues v ON c.venue_id = v.id
      WHERE c.id = NEW.court_id AND v.owner_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Player checks:
  
  -- 1. Cannot change payment_status
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify payment status';
  END IF;

  -- 2. If status is changed, it can ONLY be to 'cancelled'
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status != 'cancelled' THEN
      RAISE EXCEPTION 'Unauthorized: Can only change status to cancelled';
    END IF;
  END IF;

  -- 3. Cannot change prices or deposit amounts
  IF NEW.total_price IS DISTINCT FROM OLD.total_price OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify pricing';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_booking_fields ON public.bookings;
CREATE TRIGGER tr_protect_booking_fields
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.protect_booking_fields();
