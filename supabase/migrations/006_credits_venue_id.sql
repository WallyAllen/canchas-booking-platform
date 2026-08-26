-- Add venue_id to credits table to enforce that credits can only be used in the venue where they were generated
ALTER TABLE public.credits ADD COLUMN venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE;

-- We need to backfill existing credits if any, or they will have venue_id = NULL
-- (Assuming we are in dev/MVP, this is fine or we can do a simple update)
UPDATE public.credits
SET venue_id = (
    SELECT c.venue_id
    FROM public.bookings b
    JOIN public.courts c ON c.id = b.court_id
    WHERE b.id = credits.booking_id
)
WHERE venue_id IS NULL;

-- Make venue_id NOT NULL after backfilling
ALTER TABLE public.credits ALTER COLUMN venue_id SET NOT NULL;

-- Create index for faster querying
CREATE INDEX credits_venue_id_idx ON public.credits(venue_id);
