-- Migration 030: El bucket de adjuntos del chat pasa a privado (audit: SEC-06)
--
-- 010_chat_attachments_and_storage.sql creó `chat-images` con public = true y
-- una policy de lectura `TO public`: cualquiera con la URL podía descargar
-- cualquier adjunto, sin estar autenticado ni ser parte de la conversación.
--
-- Ya era malo cuando eran fotos de canchas. Con el pago por transferencia el
-- chat pasa a transportar comprobantes bancarios — nombre del titular, CBU,
-- banco, monto y fecha. Eso no puede vivir en un bucket público.
--
-- El path de subida es `<conversation_id>/<timestamp>.<ext>`
-- (player-chat-modal.tsx:183), así que el primer segmento identifica la
-- conversación y permite escribir una policy real de pertenencia.
--
-- `venue-photos` queda público a propósito: son fotos de la ficha pública.

UPDATE storage.buckets SET public = false WHERE id = 'chat-images';

DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;

-- Helper: ¿el usuario actual participa de esta conversación?
CREATE OR REPLACE FUNCTION public.can_access_conversation(conversation_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_uuid
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.venues v
          WHERE v.id = c.venue_id AND v.owner_id = auth.uid()
        )
      )
  ) OR public.is_platform_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

-- Lectura: solo participantes de esa conversación.
CREATE POLICY "Conversation participants can view chat images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.can_access_conversation(((storage.foldername(name))[1])::uuid)
);

-- Subida: solo a la carpeta de una conversación de la que se participa.
-- Antes, cualquier autenticado podía escribir en cualquier carpeta del bucket.
CREATE POLICY "Conversation participants can upload chat images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.can_access_conversation(((storage.foldername(name))[1])::uuid)
);
