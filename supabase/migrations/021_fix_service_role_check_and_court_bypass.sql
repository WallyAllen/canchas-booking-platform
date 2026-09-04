-- Migration 021: Fix service_role detection and close court_id/source bypass (audit ronda 2: SEC-08, SEC-02, NEG-25)
--
-- 018_fix_triggers_auth.sql checked service_role via
--   current_setting('request.jwt.claim.role', true) = 'service_role'
-- which is the legacy singular PostgREST GUC, retired in PostgREST 9 in favor
-- of the plural `request.jwt.claims` JSON GUC. If the deployed PostgREST no
-- longer sets the legacy GUC, the bypass silently never triggers and the
-- admin client (used by the Mercado Pago webhook to confirm payments) gets
-- rejected by the very trigger meant to let it through.
--
-- Fix: use auth.role(), Supabase's own helper, which already coalesces both
-- GUC conventions and is the supported way to detect service_role.
--
-- Also closes SEC-02/NEG-25: the player branch of protect_booking_fields
-- blacklisted payment_status, status, prices and dates, but never court_id
-- or source — a player could UPDATE their own booking's court_id to move it
-- to a different (possibly more expensive) court without paying the
-- difference, or flip source between 'platform' and 'manual'.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Cannot change role without platform_admin privileges';
  END IF;

  IF NEW.credit_balance IS DISTINCT FROM OLD.credit_balance THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify credit balance directly';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.protect_booking_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Venue owner bypass is evaluated against OLD.court_id, not NEW.court_id:
  -- otherwise an attacker could move a booking they don't administer onto a
  -- court they DO own, and the check below would wrongly let it through.
  IF EXISTS (
      SELECT 1 FROM public.courts c
      JOIN public.venues v ON c.venue_id = v.id
      WHERE c.id = OLD.court_id AND v.owner_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Player checks:

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify payment status';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status != 'cancelled' THEN
      RAISE EXCEPTION 'Unauthorized: Can only change status to cancelled';
    END IF;
  END IF;

  IF NEW.total_price IS DISTINCT FROM OLD.total_price OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify pricing';
  END IF;

  IF NEW.booking_date IS DISTINCT FROM OLD.booking_date OR NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    RAISE EXCEPTION 'Unauthorized: Cannot reschedule directly. Use the rescheduleBooking action.';
  END IF;

  IF NEW.is_rescheduled IS DISTINCT FROM OLD.is_rescheduled THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify is_rescheduled flag';
  END IF;

  IF NEW.court_id IS DISTINCT FROM OLD.court_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot move a booking to a different court';
  END IF;

  IF NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'Unauthorized: Cannot change booking source';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
