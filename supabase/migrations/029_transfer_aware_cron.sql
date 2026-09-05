-- Migration 029: El cron de purga tiene que distinguir Mercado Pago de transferencia
--
-- BUG QUE ARREGLA: delete_abandoned_bookings borraba toda reserva con
-- status='pending' AND payment_status='pending' a los 15 minutos. Ese plazo
-- está pensado para el checkout de Mercado Pago, que se resuelve en un par de
-- minutos dentro de la misma pestaña.
--
-- Una transferencia bancaria no funciona así: ver el CBU, abrir la app del
-- banco, transferir, sacar la captura y subirla al chat lleva bastante más de
-- 15 minutos. Con el cron anterior, el usuario transfería plata real y la
-- reserva se borraba antes de que nadie la viera.
--
-- Ahora:
--   - Mercado Pago (o método sin definir): se mantiene la ventana de 15 min.
--   - Transferencia sin comprobante: 3 horas para reportar el pago.
--   - awaiting_verification: NUNCA se borra automáticamente. Si el usuario ya
--     dijo que transfirió, la decisión de rechazar la reserva es de una persona,
--     no de un cron.

CREATE OR REPLACE FUNCTION public.delete_abandoned_bookings()
RETURNS void AS $$
BEGIN
  -- 1. Desbloquear créditos de las reservas que están por caducar
  UPDATE public.credits
  SET locked_for_booking_id = NULL
  WHERE locked_for_booking_id IN (
    SELECT id FROM public.bookings
    WHERE status = 'pending'
      AND payment_status = 'pending'
      AND (
        (COALESCE(deposit_method, 'mercadopago') <> 'transfer'
          AND created_at < NOW() - INTERVAL '15 minutes')
        OR
        (deposit_method = 'transfer'
          AND created_at < NOW() - INTERVAL '3 hours')
      )
  );

  -- 2. Borrar las reservas abandonadas
  DELETE FROM public.bookings
  WHERE status = 'pending'
    AND payment_status = 'pending'
    AND (
      (COALESCE(deposit_method, 'mercadopago') <> 'transfer'
        AND created_at < NOW() - INTERVAL '15 minutes')
      OR
      (deposit_method = 'transfer'
        AND created_at < NOW() - INTERVAL '3 hours')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
