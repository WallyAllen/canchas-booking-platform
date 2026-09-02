/* eslint-disable jsx-a11y/label-has-associated-control */
"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Settings2 } from "lucide-react"
import { updatePricing } from "@/app/dashboard/courts/actions"

export function PricingModal({ courtId, defaultPrice = 15000 }: { courtId: string, defaultPrice?: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      await updatePricing(courtId, new FormData(e.currentTarget))
      setOpen(false)
    } catch (error: unknown) {
      // @ts-expect-error fix inference
      alert("Error: " + error instanceof Error ? error.message : "Desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="secondary" size="sm" className="w-full">
          <Settings2 className="mr-2 h-4 w-4" /> Precios
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reglas de Precio</DialogTitle>
          <DialogDescription>Configura el precio base para esta cancha (MVP).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Precio General ($)</label>
            <input name="price" type="number" required defaultValue={defaultPrice} min="0" step="100" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-muted-foreground">Nota: Para simplificar esta versión demo, este precio se aplicará a todos los días y horarios.</p>
          <div className="pt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Guardando..." : "Guardar Precios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
