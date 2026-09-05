-- Migration 028: Estado "esperando verificación" para pagos por transferencia
--
-- El pago con Mercado Pago lo confirma el webhook automáticamente. Una
-- transferencia no: el usuario dice que pagó, adjunta comprobante, y una
-- persona del complejo lo verifica. Ese lapso necesita un estado propio,
-- porque `pending` significa "todavía en el embudo de pago" y lo purga el cron.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_payment_status_check
    CHECK (payment_status IN ('pending', 'awaiting_verification', 'paid', 'refunded', 'credited'));

-- Cuándo el usuario declaró haber transferido. Sirve para ordenar la cola de
-- verificación del complejo y para detectar reservas olvidadas sin revisar.
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS transfer_reported_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_awaiting_verification
    ON public.bookings (payment_status, transfer_reported_at)
    WHERE payment_status = 'awaiting_verification';
