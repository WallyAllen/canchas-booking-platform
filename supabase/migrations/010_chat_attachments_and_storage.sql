-- Add image_url to messages
ALTER TABLE public.messages ADD COLUMN image_url TEXT;

-- Insert storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('venue-photos', 'venue-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for chat-images
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Anyone can view chat images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat-images');

CREATE POLICY "Users can update their own chat images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-images' AND owner = auth.uid());

CREATE POLICY "Users can delete their own chat images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-images' AND owner = auth.uid());

-- RLS for venue-photos
CREATE POLICY "Authenticated users can upload venue photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'venue-photos');

CREATE POLICY "Anyone can view venue photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'venue-photos');

CREATE POLICY "Users can update their own venue photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'venue-photos' AND owner = auth.uid());

CREATE POLICY "Users can delete their own venue photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'venue-photos' AND owner = auth.uid());

