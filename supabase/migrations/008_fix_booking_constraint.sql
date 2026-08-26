-- Drop the old absolute constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_no_double_booking;

-- Drop the old index if it was created
DROP INDEX IF EXISTS bookings_no_double_booking_idx;

-- Create a new partial index that only enforces uniqueness for active bookings
CREATE UNIQUE INDEX bookings_no_double_booking_idx 
ON public.bookings (court_id, booking_date, start_time) 
WHERE status NOT IN ('cancelled');
