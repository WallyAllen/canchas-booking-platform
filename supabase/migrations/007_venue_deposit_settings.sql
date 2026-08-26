-- Add settings to venues to allow them to toggle deposit requirements
ALTER TABLE public.venues 
ADD COLUMN require_deposit BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN deposit_percentage INTEGER NOT NULL DEFAULT 30 CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100);
