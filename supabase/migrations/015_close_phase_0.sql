-- Migration 015: Close Phase 0 (SEC-05, SEC-06, COD-02)

-- 1. [SEC-05] Revoke UPDATE permissions on credits table for normal users
DROP POLICY IF EXISTS "Users can update their own credits (usage)" ON public.credits;
-- Only platform_admin or service_role can update credits now
CREATE POLICY "Admins can update credits" ON public.credits
FOR UPDATE USING (public.is_platform_admin());

-- 2. [SEC-06] Protect PII in profiles table
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile and admins can view all" ON public.profiles
FOR SELECT USING (auth.uid() = id OR public.is_platform_admin());

-- Create a secure public view for avatars and names (for chat and reviews)
CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT id, full_name, avatar_url
FROM public.profiles;

-- 3. [COD-02] Fix reviews RLS policy schema desync
DROP POLICY IF EXISTS "Users can insert review if they have completed booking" ON public.reviews;

CREATE POLICY "Users can insert review if they have completed booking" ON public.reviews
FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_id AND b.user_id = auth.uid() AND b.status = 'completed'
    )
);
