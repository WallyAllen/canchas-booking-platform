-- Migration 019: Credit Locks for Transactional Integrity

ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS locked_for_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

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
      AND created_at < NOW() - INTERVAL '3 minutes'
  );

  -- 2. Borrar reservas que quedaron colgadas en el flujo de pago por más de 3 minutos
  DELETE FROM public.bookings
  WHERE payment_status = 'pending' 
    AND status = 'pending'
    AND created_at < NOW() - INTERVAL '3 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
