/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/label-has-associated-control */
"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { createCourt } from "@/app/dashboard/courts/actions"

export function CourtFormModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      await createCourt(new FormData(e.currentTarget))
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
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Agregar Cancha
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Cancha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Nombre</label>
            <input name="name" required placeholder="Ej: Cancha 1" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Tipo</label>
              <select name="type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="F5">Fútbol 5</option>
                <option value="F7">Fútbol 7</option>
                <option value="F8">Fútbol 8</option>
                <option value="F11">Fútbol 11</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Superficie</label>
              <select name="surface" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="sintetico">Sintético</option>
                <option value="natural">Césped Natural</option>
                <option value="hormigon">Hormigón</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" name="is_covered" id="is_covered" className="h-4 w-4 rounded border-gray-300" />
              <label htmlFor="is_covered" className="text-sm font-medium leading-none">Techada</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" name="has_lighting" id="has_lighting" className="h-4 w-4 rounded border-gray-300" defaultChecked />
              <label htmlFor="has_lighting" className="text-sm font-medium leading-none">Iluminación</label>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium leading-none">Duración de Turno (minutos)</label>
            <select name="slot_duration_minutes" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="60">60 minutos (1 hora)</option>
              <option value="90">90 minutos (1.5 horas)</option>
              <option value="120">120 minutos (2 horas)</option>
            </select>
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Guardando..." : "Crear Cancha"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
