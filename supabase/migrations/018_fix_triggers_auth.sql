-- Migration 018: Fix trigger mismatch and service_role checking (NEW-SEC-01)
-- Replace "auth.uid() IS NULL" with proper JWT claim check to prevent anon bypass.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow bypassing if it's the service_role (using JWT claim check instead of auth.uid() IS NULL)
  IF (NULLIF(current_setting('request.jwt.claim.role', true), '')) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow bypassing if the user is a platform admin
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Otherwise, prevent changing 'role'
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Cannot change role without platform_admin privileges';
  END IF;

  -- Prevent changing 'credit_balance'
  IF NEW.credit_balance IS DISTINCT FROM OLD.credit_balance THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify credit balance directly';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.protect_booking_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow bypassing if it's the service_role (using JWT claim check instead of auth.uid() IS NULL)
  IF (NULLIF(current_setting('request.jwt.claim.role', true), '')) = 'service_role' THEN
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

  -- 4. Cannot change dates or is_rescheduled directly (must go through Admin Client in Server Action)
  IF NEW.booking_date IS DISTINCT FROM OLD.booking_date OR NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    RAISE EXCEPTION 'Unauthorized: Cannot reschedule directly. Use the rescheduleBooking action.';
  END IF;

  IF NEW.is_rescheduled IS DISTINCT FROM OLD.is_rescheduled THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify is_rescheduled flag';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
