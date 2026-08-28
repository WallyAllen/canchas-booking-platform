-- Missing Foreign Key Indexes to optimize Next.js Server Components and RLS Queries

-- 1. Index for fetching courts by venue
CREATE INDEX IF NOT EXISTS courts_venue_id_idx ON public.courts(venue_id);

-- 2. Index for fetching pricing rules by court (critical for availability grid)
CREATE INDEX IF NOT EXISTS pricing_rules_court_id_idx ON public.pricing_rules(court_id);

-- 3. Indexes for the chat system to prevent sequential scans during RLS
CREATE INDEX IF NOT EXISTS conversations_venue_id_idx ON public.conversations(venue_id);
CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);

-- 4. Index for fetching venues by owner (Dashboard Mis Canchas)
CREATE INDEX IF NOT EXISTS venues_owner_id_idx ON public.venues(owner_id);
