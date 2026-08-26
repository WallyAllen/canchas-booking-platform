/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/label-has-associated-control */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateVenueProfile, updateVenuePaymentSettings } from "@/app/dashboard/venue/actions"
import { CardContent } from "@/components/ui/card"

export function VenueProfileForm({ venue }: { venue: any }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      await updateVenueProfile(new FormData(e.currentTarget))
      alert("Perfil actualizado correctamente")
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <input type="hidden" name="venue_id" value={venue.id} />
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Nombre del Complejo</label>
            <input name="name" type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" defaultValue={venue.name} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Teléfono de Contacto</label>
            <input name="phone" type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" defaultValue={venue.phone || ''} />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Descripción</label>
          <textarea name="description" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" defaultValue={venue.description || ''} />
        </div>
        
        <div className="pt-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </CardContent>
    </form>
  )
}

export function VenueLocationForm({ venue }: { venue: any }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      await updateVenueProfile(new FormData(e.currentTarget))
      alert("Ubicación actualizada correctamente")
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <input type="hidden" name="venue_id" value={venue.id} />
        <input type="hidden" name="name" value={venue.name} />
        <input type="hidden" name="phone" value={venue.phone || ''} />
        <input type="hidden" name="description" value={venue.description || ''} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Dirección</label>
            <input name="address" type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" defaultValue={venue.address} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Ciudad</label>
            <input name="city" type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" defaultValue={venue.city} required />
          </div>
        </div>
        <div className="pt-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Actualizar Ubicación"}
          </Button>
        </div>
      </CardContent>
    </form>
  )
}

export function VenuePaymentSettingsForm({ venue }: { venue: any }) {
  const [loading, setLoading] = useState(false)
  const [requireDeposit, setRequireDeposit] = useState(venue.require_deposit ?? true)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      await updateVenuePaymentSettings(new FormData(e.currentTarget))
      alert("Configuración de pagos actualizada correctamente")
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-6">
        <input type="hidden" name="venue_id" value={venue.id} />
        
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <label className="text-base font-semibold">Exigir Seña Obligatoria</label>
            <p className="text-sm text-muted-foreground">
              Al desactivarlo, los jugadores podrán confirmar turnos sin pagar por adelantado.
            </p>
          </div>
          <div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                name="require_deposit" 
                className="sr-only peer" 
                checked={requireDeposit}
                onChange={(e) => setRequireDeposit(e.target.checked)}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        {requireDeposit && (
          <div className="space-y-2 max-w-[200px]">
            <label className="text-sm font-medium leading-none">Porcentaje de Seña (%)</label>
            <div className="flex items-center gap-2">
              <input 
                name="deposit_percentage" 
                type="number" 
                min="0" 
                max="100"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" 
                defaultValue={venue.deposit_percentage ?? 30} 
                required 
              />
            </div>
            <p className="text-xs text-muted-foreground">Recomendado: 30%</p>
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </div>
      </CardContent>
    </form>
  )
}
