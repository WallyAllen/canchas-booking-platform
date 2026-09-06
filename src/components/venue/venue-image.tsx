"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface VenueImageProps {
  src: string | null | undefined
  alt: string
  sizes?: string
  className?: string
}

/**
 * Foto de complejo con reemplazo cuando la URL está muerta.
 *
 * Las fotos son URLs externas guardadas en `venues.photos`, así que pueden dejar
 * de existir sin que la app se entere: hoy mismo hay tres que devuelven 404. Sin
 * `onError` eso se ve como una imagen rota.
 *
 * Existió un componente así, nunca se usó en ningún lado, y terminó eliminado por
 * huérfano. Esta vez viene conectado.
 */
export function VenueImage({ src, alt, sizes, className }: VenueImageProps) {
  const [falló, setFalló] = useState(false)

  if (!src || falló) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center bg-primary/10", className)}>
        <span className="text-3xl opacity-30" role="img" aria-label="Sin foto disponible">⚽</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={cn("object-cover", className)}
      onError={() => setFalló(true)}
    />
  )
}
