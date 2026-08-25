-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Profiles Table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'venue_admin', 'platform_admin')),
    credit_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Venues Table
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'La Plata',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone TEXT,
    amenities TEXT[],
    photos TEXT[],
    opening_hours JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    avg_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Courts Table
CREATE TABLE courts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('F5', 'F7', 'F8', 'F11')),
    surface TEXT NOT NULL CHECK (surface IN ('sintetico', 'natural', 'hormigon')),
    has_lighting BOOLEAN NOT NULL DEFAULT FALSE,
    is_covered BOOLEAN NOT NULL DEFAULT FALSE,
    slot_duration_minutes INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Pricing Rules Table
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    promo_price DECIMAL(10,2),
    is_promo_active BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. Bookings Table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL,
    deposit_method TEXT NOT NULL CHECK (deposit_method IN ('mercadopago', 'transfer', 'cash')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'credited')),
    booking_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
    source TEXT NOT NULL DEFAULT 'platform' CHECK (source IN ('platform', 'manual')),
    mp_payment_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT bookings_no_double_booking UNIQUE (court_id, booking_date, start_time)
);

-- 6. Reviews Table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    venue_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_at TIMESTAMPTZ
);

-- 7. Credits Table
CREATE TABLE credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
-- GiST Index for geographic search using latitude and longitude
CREATE INDEX venues_geo_idx ON venues USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));
CREATE INDEX bookings_court_date_idx ON bookings(court_id, booking_date);
CREATE INDEX bookings_user_id_idx ON bookings(user_id);
CREATE INDEX reviews_venue_id_idx ON reviews(venue_id);
CREATE INDEX credits_user_status_idx ON credits(user_id, status);

-- Triggers

-- Trigger 1: Create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Recalculate avg_rating and review_count on reviews insert/update/delete
CREATE OR REPLACE FUNCTION public.update_venue_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_venue_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_venue_id := OLD.venue_id;
    ELSE
        v_venue_id := NEW.venue_id;
    END IF;

    UPDATE public.venues
    SET 
        avg_rating = COALESCE((SELECT AVG(rating)::DECIMAL(3,2) FROM public.reviews WHERE venue_id = v_venue_id), 0.00),
        review_count = (SELECT COUNT(*) FROM public.reviews WHERE venue_id = v_venue_id)
    WHERE id = v_venue_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_changed
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_venue_rating();

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER handle_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_venues
    BEFORE UPDATE ON public.venues
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
