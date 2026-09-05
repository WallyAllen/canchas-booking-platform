"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Loader2, ImageOff } from "lucide-react"

/**
 * Renderiza un adjunto del chat desde el bucket privado `chat-images` (030).
 *
 * `messages.image_url` guarda el *path* dentro del bucket para los adjuntos
 * nuevos. Los mensajes anteriores a la migración 030 guardaron la URL pública
 * completa; esos se siguen renderizando tal cual para no romper el historial.
 */
export function ChatImage({ source, className }: { source: string; className?: string }) {
  const isLegacyPublicUrl = source.startsWith('http')
  const [url, setUrl] = useState<string | null>(isLegacyPublicUrl ? source : null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (isLegacyPublicUrl) return

    let cancelled = false
    const supabase = createClient()

    supabase.storage
      .from('chat-images')
      .createSignedUrl(source, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setFailed(true)
          return
        }
        setUrl(data.signedUrl)
      })

    return () => { cancelled = true }
  }, [source, isLegacyPublicUrl])

  if (failed) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/40 rounded-md ${className ?? ''}`}>
        <ImageOff className="h-4 w-4" />
        No se pudo cargar el adjunto
      </div>
    )
  }

  if (!url) {
    return (
      <div className={`flex items-center justify-center p-6 bg-muted/40 rounded-md ${className ?? ''}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Comprobante adjunto"
      className={className ?? "max-w-[200px] sm:max-w-[250px] rounded-md mb-2 object-cover"}
      onError={() => setFailed(true)}
    />
  )
}
