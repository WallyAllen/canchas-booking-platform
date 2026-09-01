-- Migration 025: Add missing updated_at column to bookings (audit ronda 2: COD-04)
--
-- src/app/api/webhooks/mercadopago/route.ts writes `updated_at` on every
-- booking confirmation, but the column was never added to `bookings` (only
-- `profiles` and `venues` have it). The write was silently accepted by
-- PostgREST as an unknown-but-tolerated field in some client configs, or
-- would error depending on the client — either way it doesn't belong there.
-- Add the column and reuse the existing handle_updated_at() trigger.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS handle_updated_at_bookings ON public.bookings;
CREATE TRIGGER handle_updated_at_bookings
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
