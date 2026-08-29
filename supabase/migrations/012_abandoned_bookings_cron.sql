-- 1. Asegurar que pg_cron esté disponible
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Crear la función que limpia los bookings pendientes viejos
CREATE OR REPLACE FUNCTION public.delete_abandoned_bookings()
RETURNS void AS $$
BEGIN
  -- Borrar reservas que quedaron colgadas en el flujo de pago por más de 3 minutos
  DELETE FROM public.bookings
  WHERE payment_status = 'pending' 
    AND status = 'pending'
    AND created_at < NOW() - INTERVAL '3 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Programar el trabajo para que corra cada 1 minuto usando pg_cron
-- Removemos un cron previo si existe para que la migración sea idempotente
SELECT cron.unschedule('delete-abandoned-bookings');
SELECT cron.schedule(
  'delete-abandoned-bookings',
  '* * * * *',
  'SELECT public.delete_abandoned_bookings();'
);
