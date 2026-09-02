/* eslint-disable jsx-a11y/label-has-associated-control */
"use client"

import { useState } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { Trash2, Plus, Image as ImageIcon, Loader2, Upload } from "lucide-react"
import { useRef } from "react"

interface VenuePhotosFormProps {
  venueId: string
  initialPhotos: string[]
}

export function VenuePhotosForm({ venueId, initialPhotos }: VenuePhotosFormProps) {
  const [photos, setPhotos] = useState<string[]>(initialPhotos || [])
  const [newPhotoUrl, setNewPhotoUrl] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${venueId}/${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('venue-photos')
        .upload(fileName, file)
        
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('venue-photos')
        .getPublicUrl(fileName)
        
      setPhotos([...photos, publicUrl])
      toast.add({
        title: "Foto subida",
        description: "La foto se ha subido correctamente. Recuerda guardar la galería.",
      })
    } catch (error) {
      console.error(error)
      toast.add({
        type: "error",
        title: "Error al subir",
        description: "No se pudo subir la foto. Intenta nuevamente.",
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) {
      toast.add({
        type: "error",
        title: "Ingresa un enlace",
        description: "Por favor, pega la URL de una foto o usa el botón de subir archivo.",
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
      const { error } = await supabase.from("venues")
        // @ts-expect-error fix inference
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
          Sube imágenes desde tu dispositivo o agrega mediante URL (ej. Unsplash, Imgur) para mostrar tu predio a los jugadores. La primera foto será la portada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
          <div className="flex flex-1 gap-2">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button 
              type="button" 
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full sm:w-auto shrink-0"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Subir desde equipo
            </Button>
            
            <div className="relative flex-1 hidden sm:block">
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
            <Button type="button" onClick={handleAddPhoto} variant="secondary" className="hidden sm:inline-flex">
              <Plus className="h-4 w-4 mr-2" />
              URL
            </Button>
          </div>
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
