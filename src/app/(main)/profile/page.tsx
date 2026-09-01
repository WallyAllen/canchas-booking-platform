"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { CreditsList } from "@/components/profile/credits-list"

export default function ProfilePage() {
  const { user, profile, isLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
  })

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
      })
    }
  }, [profile])

  const handleSave = async () => {
    if (!user) return
    
    setIsSaving(true)
    try {
            const { error } = await supabase.from("profiles")
        // @ts-expect-error fix inference
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
                  } as unknown)
        .eq("id", user.id)

      if (error) throw error

      toast.add({
        title: "Perfil actualizado",
        description: "Tus datos se guardaron correctamente.",
      })
    } catch {
      toast.add({
        type: "error",
        title: "Error",
        description: "No se pudieron guardar los cambios.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !user || !profile) {
    return (
      <div className="container mx-auto py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-10 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground mt-2">Gestioná tus datos personales y configuración.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Datos Personales</CardTitle>
              <CardDescription>Actualizá tu información de contacto para tus reservas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24 border">
                  <AvatarImage src={profile.avatar_url || ""} />
                  <AvatarFallback className="text-2xl">{profile.full_name?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Rol actual</p>
                  <p className="capitalize font-semibold">{profile.role.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user.email} disabled />
                  <p className="text-xs text-muted-foreground">El email está vinculado a tu cuenta y no puede cambiarse.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input 
                    id="name" 
                    value={formData.full_name} 
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Teléfono (WhatsApp)</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    value={formData.phone} 
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+54 9 11 1234-5678"
                  />
                  <p className="text-xs text-muted-foreground">Necesario para coordinar con las canchas si hay algún problema.</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-8">
          <CreditsList userId={user.id} />

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Mis Reservas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Revisá el estado de tus partidos, el historial o cancelá a tiempo.
              </p>
              <Button render={<Link href="/bookings" />} variant="outline" className="w-full justify-between">
                  Ver mis reservas
                  <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
