-- Migration 031: el cron de purga cancela en vez de borrar
--
-- BUG QUE ARREGLA: carrera entre el webhook de Mercado Pago y el cron.
--
-- El usuario paga en el minuto 14:50. El cron corre en el 15:00 y borra la
-- reserva porque todavía figura 'pending'. El webhook de MP llega en el 15:05,
-- no encuentra la fila, y el `.single()` de PostgREST devuelve PGRST116 → el
-- handler tiraba 500. MP reintenta un rato y después se rinde. Resultado: plata
-- cobrada, sin reserva, y sin ningún rastro salvo un 500 en los logs.
--
-- Borrar la fila es lo que hace irreversible el problema. Cancelarla no:
--
--   * `get_venue_availability` (020) filtra `status != 'cancelled'`, así que el
--     turno queda libre igual que antes — no se bloquea nada.
--   * El índice parcial `bookings_no_double_booking_idx` (008) tampoco cubre las
--     canceladas, así que otro usuario puede tomar el turno sin conflicto.
--   * Pero la fila sobrevive, y el webhook tardío la encuentra y puede resucitarla.
--
-- Y si mientras tanto otro se llevó el turno, el mismo índice parcial rechaza la
-- resurrección con un 23505: la base impide el overbooking sola, sin que el
-- código tenga que chequear disponibilidad y ganarle a su propia carrera.
--
-- La función conserva el nombre `delete_abandoned_bookings` a propósito: el job
-- de pg_cron se agendó por nombre en 012 y renombrarla obligaría a reagendarlo.

-- Distingue una cancelación automática por vencimiento del embudo de pago de una
-- que pidió una persona. El webhook solo puede resucitar las primeras: si el
-- usuario canceló a mano, un pago que llega después es para reembolsar, no para
-- reactivar la reserva.
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- El webhook busca por PK, pero la cola de reconciliación y el dashboard sí
-- filtran por motivo de cancelación.
CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_reason
    ON public.bookings (cancelled_reason, cancelled_at)
    WHERE cancelled_reason IS NOT NULL;
