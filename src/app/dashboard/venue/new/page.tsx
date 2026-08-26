"use client"
import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { LocationPicker } from "@/components/dashboard/venue/LocationPicker"

export default function NewVenuePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [lat, setLat] = useState<number | undefined>(undefined)
  const [lng, setLng] = useState<number | undefined>(undefined)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { error } = await supabase.from('venues').insert({
      owner_id: user.id,
      name: formData.get('name'),
      address: formData.get('address'),
      city: formData.get('city') || 'La Plata',
      latitude: lat || null,
      longitude: lng || null
    })
    
    if (!error) {
      router.push('/dashboard')
      router.refresh()
    } else {
      alert("Error al crear complejo: " + error.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Crear tu primer complejo</CardTitle>
          <CardDescription>Completa los datos básicos para empezar a gestionar tus canchas.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium leading-none">Nombre del Complejo</label>
              <input id="name" name="name" required placeholder="Ej: La Cantera Fútbol" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium leading-none">Dirección</label>
              <input id="address" name="address" required placeholder="Ej: Calle 50 1234" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            </div>

            <div className="space-y-2">
              <label htmlFor="city" className="text-sm font-medium leading-none">Ciudad</label>
              <input id="city" name="city" required defaultValue="La Plata" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium leading-none">Ubicación en el mapa</label>
              <p className="text-xs text-muted-foreground pb-2">Hacé clic o arrastrá el pin para marcar dónde queda tu predio.</p>
              <LocationPicker 
                onChange={(newLat, newLng) => {
                  setLat(newLat)
                  setLng(newLng)
                }} 
              />
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creando..." : "Crear Complejo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
