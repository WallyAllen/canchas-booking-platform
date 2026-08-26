/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/label-has-associated-control */
"use client"

import { useState } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { Trash2, Plus, Image as ImageIcon, Loader2 } from "lucide-react"

interface VenuePhotosFormProps {
  venueId: string
  initialPhotos: string[]
}

export function VenuePhotosForm({ venueId, initialPhotos }: VenuePhotosFormProps) {
  const [photos, setPhotos] = useState<string[]>(initialPhotos || [])
  const [newPhotoUrl, setNewPhotoUrl] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()

  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) {
      toast.add({
        type: "error",
        title: "Ingresa un enlace",
        description: "Por favor, pega la URL de una foto. La subida de archivos directos estará disponible próximamente.",
      })
      return
    }
    
    // basic validation
    try {
      new URL(newPhotoUrl)
      setPhotos([...photos, newPhotoUrl.trim()])
      setNewPhotoUrl("")
    } catch {
      toast.add({
        type: "error",
        title: "URL inválida",
        description: "Por favor ingresa una URL válida que comience con http:// o https://",
      })
    }
  }

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos(photos.filter((_, index) => index !== indexToRemove))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const { error } = await (supabase.from("venues") as any)
        .update({ photos })
        .eq("id", venueId)

      if (error) throw error

      toast.add({
        title: "Fotos actualizadas",
        description: "La galería de tu complejo se ha guardado correctamente.",
      })
    } catch (error) {
      console.error(error)
      toast.add({
        type: "error",
        title: "Error",
        description: "No se pudieron guardar las fotos. Intenta nuevamente.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Galería de Fotos</CardTitle>
        <CardDescription>
          Agrega imágenes mediante URL (ej. Unsplash, Imgur) para mostrar tu predio a los jugadores. La primera foto será la portada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="https://ejemplo.com/foto.jpg" 
              className="pl-9"
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddPhoto()
                }
              }}
            />
          </div>
          <Button type="button" onClick={handleAddPhoto} variant="secondary">
            <Plus className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div key={index} className="group relative aspect-video bg-muted rounded-md overflow-hidden border border-border/50">
                <Image 
                  src={photo} 
                  alt={`Foto ${index + 1}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                  onError={(e) => {
                    e.currentTarget.srcset = '';
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>'
                  }}
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon" 
                    className="h-7 w-7 rounded-full shadow-md"
                    onClick={() => handleRemovePhoto(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {index === 0 && (
                  <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-xs text-center py-1 font-medium">
                    Portada
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center border-2 border-dashed border-border/50 rounded-lg bg-muted/20">
            <p className="text-muted-foreground text-sm">No hay fotos cargadas todavía.</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end border-t pt-6">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar Galería
        </Button>
      </CardFooter>
    </Card>
  )
}
