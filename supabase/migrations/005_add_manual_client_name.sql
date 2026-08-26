-- Add manual_client_name column to bookings table to support manual reservations without a real user profile
ALTER TABLE public.bookings ADD COLUMN manual_client_name TEXT;
