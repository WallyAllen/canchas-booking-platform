-- Migration 016: Extend abandoned booking cron window from 3 to 15 minutes (ARC-03)

CREATE OR REPLACE FUNCTION public.delete_abandoned_bookings()
RETURNS void AS $$
BEGIN
  -- Borrar reservas que quedaron colgadas en el flujo de pago por más de 15 minutos
  DELETE FROM public.bookings
  WHERE payment_status = 'pending' 
    AND status = 'pending'
    AND created_at < NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
