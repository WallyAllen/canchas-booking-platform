/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { hoursUntilBooking } from "@/lib/utils/dates"
import { AlertCircle, CalendarX } from "lucide-react"

interface CancelDialogProps {
  booking: import("@/types/domain").BookingWithDetails
  onCancelSuccess?: () => void
}

export function CancelDialog({ booking, onCancelSuccess }: CancelDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)

  // Calc diff hours directly on client for display
  const diffHours = hoursUntilBooking(booking.booking_date, booking.start_time)
  
  const canCancel = diffHours > 1
  const givesCredit = diffHours >= 6
  const depositAmount = Math.ceil(booking.total_price * 0.3)

  const handleCancel = async () => {
    if (!confirmChecked) return
    setLoading(true)
    
    try {
      const res = await fetch(`/api/booking/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setOpen(false)
        if (onCancelSuccess) {
          onCancelSuccess()
        } else {
          router.refresh()
        }
      } else {
        alert(data.error || 'Error al cancelar')
      }
    } catch (error) {
      alert('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground">
          Cancelar
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarX className="h-5 w-5 text-destructive" />
            Cancelar Reserva
          </DialogTitle>
          <DialogDescription>
            Lee atentamente las políticas de cancelación antes de proceder.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {!canCancel ? (
            <div className="bg-red-50 text-red-800 p-4 rounded-lg flex gap-3 text-sm border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>No podés cancelar esta reserva porque falta menos de 1 hora para el partido.</p>
            </div>
          ) : givesCredit ? (
            <div className="bg-green-50 text-green-800 p-4 rounded-lg flex gap-3 text-sm border border-green-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">Cancelación con Anticipación (&gt; 6hs)</p>
                <p>Al cancelar ahora, recibirás <strong>${depositAmount.toLocaleString('es-AR')} en Créditos</strong> en tu cuenta para usar en tu próxima reserva.</p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex gap-3 text-sm border border-amber-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">Cancelación Tardía ({"<"} 6hs)</p>
                <p>Al cancelar con menos de 6 horas de anticipación, <strong>perdés la seña abonada de ${depositAmount.toLocaleString('es-AR')}</strong>.</p>
              </div>
            </div>
          )}

          {canCancel && (
            <div className="flex items-start space-x-2 mt-6">
              <input 
                type="checkbox"
                id="terms" 
                checked={confirmChecked} 
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-1"
              />
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Entiendo y acepto la política de cancelación.
              </label>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Volver
          </Button>
          {canCancel && (
            <Button variant="destructive" onClick={handleCancel} disabled={!confirmChecked || loading}>
              {loading ? "Cancelando..." : "Confirmar Cancelación"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
