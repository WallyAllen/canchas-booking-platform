/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/label-has-associated-control */
"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { createManualBooking } from "@/app/dashboard/schedule/actions"

interface Court {
  id: string
  name: string
  court_type: string
}

export function ManualBookingModal({ courts, currentDate }: { courts: Court[], currentDate: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const hours = [16, 17, 18, 19, 20, 21, 22, 23]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      await createManualBooking(new FormData(e.currentTarget))
      setOpen(false)
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="ml-2">
          <Plus className="mr-2 h-4 w-4" /> Nuevo Turno
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Reserva Manual</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Cancha</label>
            <select name="court_id" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {courts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Fecha</label>
              <input name="date" type="date" required defaultValue={currentDate} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Horario</label>
              <select name="time" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {hours.map(h => (
                  <option key={h} value={`${h}:00:00`}>{h}:00 hs</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Nombre del Cliente (Opcional)</label>
            <input name="client_name" placeholder="Ej: Juan Pérez" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <p className="text-xs text-muted-foreground">Nota: Para usar esta función debes correr la migración 005 en Supabase.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Precio Acordado ($)</label>
            <input name="price" type="number" defaultValue={15000} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Guardando..." : "Confirmar Reserva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
