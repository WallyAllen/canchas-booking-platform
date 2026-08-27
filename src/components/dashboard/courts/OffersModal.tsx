"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tag, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { saveOffers } from "@/app/dashboard/courts/actions"
import { useFormStatus } from "react-dom"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Guardando..." : "Guardar Ofertas"}
    </Button>
  )
}

const DAYS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
]

export function OffersModal({ courtId, basePrice }: { courtId: string, basePrice: number }) {
  const [open, setOpen] = useState(false)
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      setLoading(true)
      (supabase.from("pricing_rules") as any)
        .select("*")
        .eq("court_id", courtId)
        .eq("is_promo_active", true)
        .then(({ data }: { data: any[] }) => {
          if (data) {
            setOffers(data.map((d: any) => ({
              id: d.id,
              day_of_week: d.day_of_week.toString(),
              start_time: d.start_time.substring(0, 5),
              end_time: d.end_time.substring(0, 5),
              discount_percentage: Math.round((1 - (d.promo_price / d.price)) * 100)
            })))
          }
          setLoading(false)
        })
    }
  }, [open, courtId])

  const addOffer = () => {
    setOffers([...offers, { id: crypto.randomUUID(), day_of_week: "1", start_time: "10:00", end_time: "14:00", discount_percentage: 20 }])
  }

  const removeOffer = (id: string) => {
    setOffers(offers.filter(o => o.id !== id))
  }

  const updateOffer = (id: string, field: string, value: any) => {
    setOffers(offers.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  async function handleAction(formData: FormData) {
    try {
      // Pass offers as JSON
      formData.append("offers", JSON.stringify(offers))
      formData.append("basePrice", basePrice.toString())
      await saveOffers(courtId, formData)
      setOpen(false)
    } catch (error: any) {
      alert("Error: " + error.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="w-full mt-2">
          <Tag className="mr-2 h-4 w-4" /> Gestionar Ofertas
        </Button>
      } />
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ofertas Promocionales</DialogTitle>
          <DialogDescription>
            Definí descuentos por día y horario. Precio base actual: ${basePrice}
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        ) : (
          <form action={handleAction} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
              {offers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  No hay ofertas activas.
                </div>
              ) : (
                offers.map((offer, index) => {
                  const netPrice = basePrice * (1 - (offer.discount_percentage / 100))
                  return (
                    <div key={offer.id} className="p-3 border rounded-lg bg-card space-y-3 relative">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-6 w-6 text-destructive"
                        onClick={() => removeOffer(offer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pr-6">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Día</label>
                          <Select value={offer.day_of_week} onValueChange={v => updateOffer(offer.id, "day_of_week", v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Inicio</label>
                          <Input type="time" className="h-8 text-xs" value={offer.start_time} onChange={e => updateOffer(offer.id, "start_time", e.target.value)} required />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Fin</label>
                          <Input type="time" className="h-8 text-xs" value={offer.end_time} onChange={e => updateOffer(offer.id, "end_time", e.target.value)} required />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">% Descuento</label>
                          <Input type="number" min="1" max="99" className="h-8 text-xs" value={offer.discount_percentage} onChange={e => updateOffer(offer.id, "discount_percentage", parseInt(e.target.value) || 0)} required />
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">Precio final (aprox)</span>
                        <span className="font-bold text-primary">${netPrice.toFixed(0)}</span>
                      </div>
                    </div>
                  )
                })
              )}
              
              <Button type="button" variant="outline" className="w-full border-dashed" onClick={addOffer}>
                <Plus className="mr-2 h-4 w-4" /> Agregar Oferta
              </Button>
            </div>
            
            <div className="pt-4 mt-2 border-t">
              <SubmitButton />
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
