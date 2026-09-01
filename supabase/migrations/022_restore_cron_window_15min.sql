-- Migration 022: Restore abandoned-booking cron window to 15 minutes (audit ronda 2: ARQ-04/NEG-16/SEC-29)
--
-- 016_extend_booking_cron.sql deliberately widened the grace window from 3 to
-- 15 minutes (commit message: "Extend abandoned booking cron window from 3
-- to 15 minutes"). 019_credit_locks.sql redefined the same function to add
-- credit-unlock logic and, in doing so, silently reverted the interval back
-- to 3 minutes — undoing the 016 fix without mentioning it. A user who takes
-- longer than 3 minutes to complete the Mercado Pago checkout risks paying
-- for a booking that has already been deleted.
--
-- This migration keeps the credit-unlock logic from 019 and restores the
-- 15-minute window from 016.

CREATE OR REPLACE FUNCTION public.delete_abandoned_bookings()
RETURNS void AS $$
BEGIN
  -- 1. Desbloquear los créditos asociados a reservas pendientes y viejas (restaurar a available)
  UPDATE public.credits
  SET locked_for_booking_id = NULL
  WHERE locked_for_booking_id IN (
    SELECT id FROM public.bookings
    WHERE payment_status = 'pending'
      AND status = 'pending'
      AND created_at < NOW() - INTERVAL '15 minutes'
  );

  -- 2. Borrar reservas que quedaron colgadas en el flujo de pago por más de 15 minutos
  DELETE FROM public.bookings
  WHERE payment_status = 'pending'
    AND status = 'pending'
    AND created_at < NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
