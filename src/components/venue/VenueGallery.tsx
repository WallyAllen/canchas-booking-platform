/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VenueGalleryProps {
  photos: string[]
  venueName: string
}

export function VenueGallery({ photos, venueName }: VenueGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Use a fallback if no photos exist
  const displayPhotos = photos?.length > 0 ? photos : []
  const hasPhotos = displayPhotos.length > 0

  const nextPhoto = () => setCurrentIndex((prev) => (prev + 1) % displayPhotos.length)
  const prevPhoto = () => setCurrentIndex((prev) => (prev - 1 + displayPhotos.length) % displayPhotos.length)

  if (!hasPhotos) {
    return (
      <div className="w-full aspect-video md:aspect-[21/9] bg-muted flex flex-col items-center justify-center rounded-xl overflow-hidden border border-border/50">
        <span className="text-6xl opacity-20 mb-2">⚽</span>
        <span className="text-muted-foreground font-medium">No hay fotos disponibles</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-xl overflow-hidden h-[300px] md:h-[400px]">
      {/* Imagen Principal */}
      <div className="md:col-span-3 relative h-full group">
        <Dialog>
          <DialogTrigger render={
            <div className="absolute inset-0 cursor-pointer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={displayPhotos[0]} 
                alt={`${venueName} - Foto principal`} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 bg-background/80 backdrop-blur-sm p-3 rounded-full text-foreground transition-opacity">
                  <Maximize2 className="h-5 w-5" />
                </div>
              </div>
            </div>
          } />
          <DialogContent className="max-w-4xl p-1 bg-transparent border-none shadow-none">
            <DialogTitle className="sr-only">Galería de {venueName}</DialogTitle>
            <div className="relative aspect-video w-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={displayPhotos[currentIndex]} 
                alt={`${venueName} - Galería ${currentIndex + 1}`} 
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
              
              {displayPhotos.length > 1 && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 text-foreground rounded-full"
                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 text-foreground rounded-full"
                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md">
                    {currentIndex + 1} / {displayPhotos.length}
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Thumbnails laterales (desktop) */}
      <div className="hidden md:flex flex-col gap-2 h-full">
        {displayPhotos.slice(1, 4).map((photo, i) => (
          <div key={i} className="relative h-1/3 overflow-hidden cursor-pointer group" onClick={() => setCurrentIndex(i + 1)}>
            <Dialog>
              <DialogTrigger render={
                <div className="w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={photo} 
                    alt={`${venueName} - Miniatura ${i + 1}`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                  
                  {i === 2 && displayPhotos.length > 4 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">+{displayPhotos.length - 4}</span>
                    </div>
                  )}
                </div>
              } />
            </Dialog>
          </div>
        ))}
        {/* Placeholder si hay menos de 4 fotos */}
        {displayPhotos.length < 4 && Array.from({ length: 4 - displayPhotos.length }).map((_, i) => (
          <div key={`empty-${i}`} className="h-1/3 bg-muted border border-border/50 border-dashed rounded-md flex items-center justify-center">
            <span className="text-muted-foreground/30 text-2xl">⚽</span>
          </div>
        ))}
      </div>
    </div>
  )
}
