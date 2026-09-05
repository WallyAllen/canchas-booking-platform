-- Migration 032: cola de reconciliación para pagos huérfanos
--
-- La 031 hizo que el cron cancele en vez de borrar, así que el webhook de Mercado
-- Pago ya puede resucitar una reserva vencida. Pero quedan cuatro casos en los que
-- el pago está aprobado y NO hay reserva que confirmar:
--
--   reserva_inexistente    la fila no está (borrada a mano, o anterior a la 031)
--   cancelada_a_proposito  la canceló una persona; el pago llegó tarde
--   turno_ya_vencido       el horario ya pasó cuando entró el webhook
--   turno_reasignado       otro usuario tomó el turno mientras estaba cancelada
--
-- En todos, hay plata cobrada sin contraparte y alguien tiene que reembolsarla.
-- Hasta ahora eso vivía en un console.error: se pierde con la rotación de logs y
-- nadie lo mira. Esto lo convierte en una fila que se puede listar y cerrar.

CREATE TABLE IF NOT EXISTS public.payment_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- UNIQUE es lo que hace idempotente al webhook: Mercado Pago reintenta la
    -- notificación, y sin esto cada reintento agregaría una fila duplicada a la
    -- cola. El handler inserta con ON CONFLICT DO NOTHING.
    mp_payment_id TEXT NOT NULL UNIQUE,

    -- Sin FK a bookings a propósito: el caso más común es justamente que esa
    -- reserva ya no exista. Una FK haría fallar el insert cuando más importa.
    booking_id UUID,

    reason TEXT NOT NULL CHECK (reason IN (
        'reserva_inexistente',
        'cancelada_a_proposito',
        'turno_ya_vencido',
        'turno_reasignado'
    )),

    amount DECIMAL(10,2),
    payer_email TEXT,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'refunded', 'dismissed')),
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La cola se consulta casi siempre filtrando lo que falta resolver.
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_pending
    ON public.payment_reconciliations (created_at DESC)
    WHERE status = 'pending';

ALTER TABLE public.payment_reconciliations ENABLE ROW LEVEL SECURITY;

-- Solo el admin de plataforma. Un dueño de complejo no tiene por qué ver los
-- datos de pago de un usuario que quedó sin reserva, y el usuario tampoco puede
-- resolver su propio reembolso.
CREATE POLICY "Solo platform_admin ve la cola de reconciliación"
ON public.payment_reconciliations
FOR ALL USING (public.is_platform_admin());
