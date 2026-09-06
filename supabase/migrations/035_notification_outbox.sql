-- Migration 035: outbox de notificaciones con reintentos
--
-- Hasta acá, notify() intentaba enviar una sola vez y, si Resend o WhatsApp
-- fallaban, el mensaje se perdía con un console.error. Para una confirmación de
-- reserva eso significa que el usuario pagó y nunca recibió el comprobante, sin
-- que nadie se entere.
--
-- El patrón es el clásico transactional outbox: el envío se registra primero en
-- la base y recién después se intenta despachar. Si el intento falla, la fila
-- queda pendiente y un cron la reintenta con backoff. Nada depende de que el
-- proceso que originó el evento siga vivo, que es justamente lo que no se puede
-- asumir en serverless.
--
-- Por qué no lo agenda pg_cron: pg_cron corre SQL dentro de Postgres y no puede
-- llamar a las APIs de Resend ni de WhatsApp. El drenaje lo hace una ruta HTTP
-- (/api/cron/notifications) que dispara Vercel Cron.

CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    event TEXT NOT NULL CHECK (event IN (
        'booking_confirmed',
        'booking_reminder',
        'booking_cancelled',
        'welcome'
    )),

    -- Los datos ya resueltos del envío (reserva, usuario, complejo). Se guarda el
    -- snapshot y no los ids: si la reserva se modifica entre el intento fallido y
    -- el reintento, el mensaje debe reflejar lo que pasó cuando ocurrió el evento.
    payload JSONB NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,

    -- Backoff: hasta cuándo no tiene sentido volver a intentar.
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- El drenaje siempre pregunta por lo mismo: qué está pendiente y ya vencido.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pendientes
    ON public.notification_outbox (next_attempt_at)
    WHERE status = 'pending';

-- Para revisar a mano qué se dio por perdido.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_fallidas
    ON public.notification_outbox (created_at DESC)
    WHERE status = 'failed';

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- Sin policies: RLS es default-deny, así que solo el service_role la toca. Los
-- payloads tienen mails y teléfonos de usuarios; ningún cliente con la anon key
-- tiene por qué leerlos.
