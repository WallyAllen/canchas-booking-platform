-- Migration 023: Auto-complete past bookings (audit ronda 2: NEG-08)
--
-- Nothing in the codebase ever transitions a booking to 'completed'. Since
-- reviews.insert RLS (015_close_phase_0.sql:23-30) requires a booking with
-- status = 'completed', no review can ever be submitted without this.
--
-- Runs in the same 1-minute pg_cron schedule as delete_abandoned_bookings.

CREATE OR REPLACE FUNCTION public.complete_past_bookings()
RETURNS void AS $$
BEGIN
  -- protect_booking_fields (018/021) fires on every UPDATE regardless of RLS
  -- bypass, and its player branch rejects any status change other than
  -- 'cancelled'. This is a trusted, internal, unattended write — disable
  -- normal triggers for the duration of this transaction rather than
  -- widening the trigger's bypass conditions for a caller with no auth
  -- context at all (cron jobs have no auth.uid()/auth.role()).
  SET LOCAL session_replication_role = replica;

  UPDATE public.bookings
  SET status = 'completed'
  WHERE status = 'confirmed'
    AND payment_status IN ('paid', 'credited')
    AND (booking_date + end_time) < (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires');

  SET LOCAL session_replication_role = DEFAULT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DO $$
BEGIN
  PERFORM cron.unschedule('complete-past-bookings');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorar si el trabajo no existe
END $$;

SELECT cron.schedule(
  'complete-past-bookings',
  '*/5 * * * *',
  'SELECT public.complete_past_bookings();'
);
