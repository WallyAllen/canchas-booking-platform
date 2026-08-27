-- 1. Conversations Table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
    unread_user_count INTEGER NOT NULL DEFAULT 0,
    unread_venue_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversations_unique_venue_user UNIQUE (venue_id, user_id)
);

-- 2. Messages Table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to update conversation's last_message_at and updated_at
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET 
        last_message_at = NEW.created_at,
        updated_at = NOW(),
        -- If sender is a venue admin (or platform admin), increment user unread count
        unread_user_count = CASE 
            WHEN NEW.sender_id != user_id THEN unread_user_count + 1 
            ELSE unread_user_count 
        END,
        -- If sender is the user, increment venue unread count
        unread_venue_count = CASE 
            WHEN NEW.sender_id = user_id THEN unread_venue_count + 1 
            ELSE unread_venue_count 
        END
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_inserted
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

CREATE TRIGGER handle_updated_at_conversations
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies for conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Players can see their own conversations
CREATE POLICY "Users can view their own conversations" 
ON conversations FOR SELECT 
USING (user_id = auth.uid());

-- Players can create conversations
CREATE POLICY "Users can create conversations" 
ON conversations FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Players can update their own conversations (e.g. mark read)
CREATE POLICY "Users can update their own conversations" 
ON conversations FOR UPDATE 
USING (user_id = auth.uid());

-- Venue admins can see conversations for their venues
CREATE POLICY "Venue admins can view conversations for their venues" 
ON conversations FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.id = conversations.venue_id 
        AND venues.owner_id = auth.uid()
    )
);

-- Venue admins can update conversations for their venues
CREATE POLICY "Venue admins can update conversations for their venues" 
ON conversations FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM venues 
        WHERE venues.id = conversations.venue_id 
        AND venues.owner_id = auth.uid()
    )
);


-- RLS Policies for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Anyone who can read the conversation can read its messages
CREATE POLICY "Users can view messages of their conversations" 
ON messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM venues WHERE venues.id = conversations.venue_id AND venues.owner_id = auth.uid()
        ))
    )
);

-- Anyone who can read the conversation can insert messages
CREATE POLICY "Users can insert messages into their conversations" 
ON messages FOR INSERT 
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM venues WHERE venues.id = conversations.venue_id AND venues.owner_id = auth.uid()
        ))
    )
);


-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
