-- Migration 033: el cron también libera créditos de reservas ya canceladas
--
-- `credits.locked_for_booking_id` se limpiaba solo por el `ON DELETE SET NULL`
-- de la migración 019. Desde que dejamos de borrar reservas (031, y ahora
-- también `cancelPendingBooking`), ese automatismo no se dispara más: los
-- créditos se desbloquean únicamente si el código lo hace explícito.
--
-- El paso 1 de delete_abandoned_bookings solo mira reservas `status='pending'`,
-- así que una cancelada con créditos todavía atados no la barre nadie. Cualquier
-- desbloqueo explícito que falle —el de `cancelPendingBooking`, el de
-- `rejectTransferPayment`— deja plata del usuario trabada de forma permanente.
--
-- Esto agrega el barrido que faltaba: si el crédito apunta a una reserva
-- cancelada, se libera. Es idempotente y sirve de red para los tres caminos.

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

  -- 2. Cancelar (ya no borrar) las reservas abandonadas. Mismas ventanas que 029:
  --    Mercado Pago 15 min, transferencia 3 h, y `awaiting_verification` nunca
  --    entra acá porque exige payment_status = 'pending'.
  UPDATE public.bookings
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_reason = 'payment_timeout'
  WHERE status = 'pending'
    AND payment_status = 'pending'
    AND (
      (COALESCE(deposit_method, 'mercadopago') <> 'transfer'
        AND created_at < NOW() - INTERVAL '15 minutes')
      OR
      (deposit_method = 'transfer'
        AND created_at < NOW() - INTERVAL '3 hours')
    );

  -- 3. Red de seguridad: ningún crédito debería seguir atado a una reserva
  --    cancelada. Cubre los desbloqueos explícitos que hayan fallado.
  UPDATE public.credits
  SET locked_for_booking_id = NULL
  WHERE locked_for_booking_id IN (
    SELECT id FROM public.bookings WHERE status = 'cancelled'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
