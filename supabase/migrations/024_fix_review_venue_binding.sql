-- Migration 024: Bind review.venue_id to the booking's actual venue (audit ronda 2: SEC-09/NEG-24)
--
-- The INSERT policy from 015_close_phase_0.sql checks that booking_id
-- belongs to the reviewer and is completed, but never checks that the
-- venue_id being written matches the venue the booking was actually made
-- at. A user with one completed booking at Venue A could insert a review
-- with venue_id = Venue B, review-bombing a complex they never played at.

DROP POLICY IF EXISTS "Users can insert review if they have completed booking" ON public.reviews;

CREATE POLICY "Users can insert review if they have completed booking" ON public.reviews
FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.bookings b
        JOIN public.courts c ON c.id = b.court_id
        WHERE b.id = booking_id
          AND b.user_id = auth.uid()
          AND b.status = 'completed'
          AND c.venue_id = reviews.venue_id
    )
);

-- SEC-10/NEG-06: "Venue owners can update venue_response" (002_rls_policies.sql:103-106)
-- has no WITH CHECK and RLS can't restrict UPDATE to a single column, so a
-- venue owner can silently rewrite the rating and comment of a review left
-- by a real player at their own complex. Enforce the column restriction
-- with a trigger, the same pattern already used for profiles and bookings.
CREATE OR REPLACE FUNCTION public.protect_review_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Review author editing their own review: everything except the venue
  -- reply is theirs to change.
  IF OLD.user_id = auth.uid() THEN
    IF NEW.venue_response IS DISTINCT FROM OLD.venue_response THEN
      RAISE EXCEPTION 'Unauthorized: Only the venue can write a response';
    END IF;
    RETURN NEW;
  END IF;

  -- Venue owner: only venue_response is theirs to change.
  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.comment IS DISTINCT FROM OLD.comment
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
     OR NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify another player''s review';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_protect_review_fields ON public.reviews;
CREATE TRIGGER tr_protect_review_fields
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.protect_review_fields();
