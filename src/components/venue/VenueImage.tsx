"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface VenueImageProps {
  src: string | null
  alt: string
  className?: string
  fallbackClassName?: string
}

export function VenueImage({ src, alt, className, fallbackClassName }: VenueImageProps) {
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center bg-primary/10 text-primary", fallbackClassName)}>
        <span className="text-4xl opacity-20">⚽</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={cn("object-cover", className)}
      onError={() => setError(true)}
    />
  )
}
