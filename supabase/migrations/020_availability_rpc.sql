-- Migration 020: RPC for Secure Court Availability (NEW-ARC-04 optimization)

CREATE OR REPLACE FUNCTION public.get_venue_availability(p_venue_id UUID, p_date DATE)
RETURNS TABLE (
  court_id UUID,
  start_time TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT b.court_id, b.start_time
  FROM public.bookings b
  JOIN public.courts c ON b.court_id = c.id
  WHERE c.venue_id = p_venue_id
    AND b.booking_date = p_date
    AND b.status != 'cancelled';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
