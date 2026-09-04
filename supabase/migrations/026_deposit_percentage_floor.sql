-- Migration 026: Enforce the documented 30% deposit floor at the DB level (audit ronda 2: NEG-14)
--
-- AGENTS.md declares "Seña (deposit): 30% minimum of total price" as a
-- product rule, but 007_venue_deposit_settings.sql never constrained the
-- column, so 0% and 100% were both valid configurations. The application
-- layer now clamps this on write (dashboard/venue/actions.ts); this adds
-- the same floor as a CHECK constraint so it holds regardless of caller.
--
-- Existing rows below 30 are raised to 30 rather than left violating a new
-- constraint silently.

UPDATE public.venues SET deposit_percentage = 30 WHERE deposit_percentage < 30;

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_deposit_percentage_check;

ALTER TABLE public.venues
  ADD CONSTRAINT venues_deposit_percentage_check
  CHECK (deposit_percentage >= 30 AND deposit_percentage <= 100);
