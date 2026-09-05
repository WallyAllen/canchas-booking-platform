-- Migration 027: Datos bancarios por complejo para pago por transferencia
--
-- Mercado Pago queda como "próximamente" hasta conseguir credenciales, así que
-- la transferencia bancaria pasa a ser el método de pago real de la seña.
--
-- Los datos van en tabla aparte y NO como columnas de `venues` a propósito:
-- `venues` se lee públicamente en la ficha del complejo y en la búsqueda
-- (002_rls_policies.sql:30-31 permite SELECT a cualquiera sobre venues activos).
-- Sumar el CBU ahí publicaría los datos bancarios de todos los complejos de la
-- plataforma en un endpoint scrapeable. Con tabla aparte, la lectura queda
-- restringida a quien realmente tiene una reserva pendiente de pago ahí.

CREATE TABLE IF NOT EXISTS public.venue_payment_details (
    venue_id UUID PRIMARY KEY REFERENCES public.venues(id) ON DELETE CASCADE,
    alias TEXT,
    cbu TEXT,
    holder_name TEXT,
    bank_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Sin al menos uno de los dos no se puede transferir.
    CONSTRAINT venue_payment_details_needs_destination
        CHECK (COALESCE(alias, '') <> '' OR COALESCE(cbu, '') <> '')
);

ALTER TABLE public.venue_payment_details ENABLE ROW LEVEL SECURITY;

-- El dueño gestiona los datos de sus propios complejos.
CREATE POLICY "Venue owners can view their payment details"
ON public.venue_payment_details FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

CREATE POLICY "Venue owners can insert their payment details"
ON public.venue_payment_details FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

CREATE POLICY "Venue owners can update their payment details"
ON public.venue_payment_details FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

CREATE POLICY "Venue owners can delete their payment details"
ON public.venue_payment_details FOR DELETE
USING (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

-- Un jugador solo ve el CBU si tiene una reserva viva por transferencia en ese
-- complejo. Sin reserva no hay motivo para exponerle los datos bancarios.
CREATE POLICY "Players with a live transfer booking can view payment details"
ON public.venue_payment_details FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.bookings b
        JOIN public.courts c ON c.id = b.court_id
        WHERE c.venue_id = venue_payment_details.venue_id
          AND b.user_id = auth.uid()
          AND b.deposit_method = 'transfer'
          AND b.status = 'pending'
          AND b.payment_status IN ('pending', 'awaiting_verification')
    )
);

CREATE POLICY "Platform admins can view all payment details"
ON public.venue_payment_details FOR SELECT
USING (public.is_platform_admin());

CREATE TRIGGER handle_updated_at_venue_payment_details
    BEFORE UPDATE ON public.venue_payment_details
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
