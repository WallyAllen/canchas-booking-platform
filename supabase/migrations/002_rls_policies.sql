-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- Helper Function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'platform_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);
-- Insert is handled by trigger (bypasses RLS)

-- Venues Policies
CREATE POLICY "Active venues are viewable by everyone" ON public.venues
FOR SELECT USING (is_active = true OR owner_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Venue owners and admins can insert venues" ON public.venues
FOR INSERT WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Venue owners and admins can update venues" ON public.venues
FOR UPDATE USING (owner_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Venue owners and admins can delete venues" ON public.venues
FOR DELETE USING (owner_id = auth.uid() OR public.is_platform_admin());

-- Courts Policies
CREATE POLICY "Courts in active venues are viewable by everyone" ON public.courts
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND (v.is_active = true OR v.owner_id = auth.uid() OR public.is_platform_admin()))
);

CREATE POLICY "Venue owners can manage their courts" ON public.courts
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid()) OR public.is_platform_admin()
);

-- Pricing Rules Policies
CREATE POLICY "Pricing rules are viewable by everyone" ON public.pricing_rules
FOR SELECT USING (true);

CREATE POLICY "Venue owners can manage pricing rules" ON public.pricing_rules
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.courts c
        JOIN public.venues v ON c.venue_id = v.id
        WHERE c.id = court_id AND v.owner_id = auth.uid()
    ) OR public.is_platform_admin()
);

-- Bookings Policies
CREATE POLICY "Users can view their own bookings and venue owners can view their venue bookings" ON public.bookings
FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.courts c
        JOIN public.venues v ON c.venue_id = v.id
        WHERE c.id = court_id AND v.owner_id = auth.uid()
    ) OR public.is_platform_admin()
);

CREATE POLICY "Authenticated users can insert bookings" ON public.bookings
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can update their bookings (e.g. cancel) or venue owners can update" ON public.bookings
FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.courts c
        JOIN public.venues v ON c.venue_id = v.id
        WHERE c.id = court_id AND v.owner_id = auth.uid()
    ) OR public.is_platform_admin()
);

-- Reviews Policies
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews
FOR SELECT USING (true);

CREATE POLICY "Users can insert review if they have completed booking" ON public.reviews
FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_id AND b.user_id = auth.uid() AND b.booking_status = 'completed'
    )
);

CREATE POLICY "Venue owners can update venue_response" ON public.reviews
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid()) OR public.is_platform_admin()
);

-- Credits Policies
CREATE POLICY "Users can view their own credits" ON public.credits
FOR SELECT USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Users can update their own credits (usage)" ON public.credits
FOR UPDATE USING (user_id = auth.uid() OR public.is_platform_admin());
