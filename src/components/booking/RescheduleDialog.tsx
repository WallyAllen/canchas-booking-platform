/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { AlertCircle, CalendarClock } from "lucide-react"

interface RescheduleDialogProps {
  booking: any
  onSuccess?: () => void
}

export function RescheduleDialog({ booking, onSuccess }: RescheduleDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const now = new Date()
  const bookingDate = new Date(`${booking.booking_date}T${booking.start_time}`)
  const diffHours = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  
  const canReschedule = diffHours >= 2

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="h-8 text-xs">
          Reprogramar
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Reprogramar Reserva
          </DialogTitle>
          <DialogDescription>
            Selecciona una nueva fecha y horario para tu partido.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {!canReschedule ? (
            <div className="bg-red-50 text-red-800 p-4 rounded-lg flex gap-3 text-sm border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>No podés reprogramar esta reserva porque falta menos de 2 horas para el partido.</p>
            </div>
          ) : (
            <div className="bg-muted p-4 rounded-lg text-sm text-center">
              <p className="mb-4">Funcionalidad de reprogramación en desarrollo.</p>
              <p className="text-xs text-muted-foreground">Por ahora, por favor cancela la reserva (recibirás créditos si corresponde) y vuelve a reservar en el horario deseado.</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
