"use client"

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
import { toast } from '@/components/ui/use-toast'
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

import { AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, ChevronRight, MapPin, Calendar, Clock, CreditCard, Banknote } from "lucide-react"

interface BookingWizardProps {
  booking: {
    id?: string
    courtId: string
    courtName: string
    venueName: string
    venueAddress?: string
    venueCity?: string
    date: string
    time: string
    price: number
    isPromo: boolean
    requireDeposit: boolean
    depositAmount: number
  }
}

export function BookingWizard({ booking }: BookingWizardProps) {
  const router = useRouter()

  // Limpiar reserva si el usuario cierra la pestaña o navega hacia atrás en el navegador


  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Mercado Pago queda deshabilitado ("Próximamente") hasta tener credenciales
  // de producción; la transferencia bancaria es el método real por ahora.
  const [paymentMethod, setPaymentMethod] = useState<'mercadopago' | 'transfer'>('transfer')

  const { depositAmount, requireDeposit } = booking
  const remainingAmount = booking.price - depositAmount

  const handleNext = () => setStep(step + 1)
  const handleBack = () => setStep(step - 1)

  const handlePayment = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/booking/create-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId: booking.courtId,
          date: booking.date,
          time: booking.time
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear la reserva')
      }

      router.push(data.redirectTo)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'No se pudo crear la reserva.'
      setError(message)
      toast({ title: 'Error', description: message })
      setLoading(false)
    }
  }

  // Helper date display
  const dateObj = new Date(`${booking.date}T12:00:00`)
  const displayDate = dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="w-full">
      {/* Progress */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10" />
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 transition-all duration-300" 
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        />
        
        {[1, 2, 3].map((num) => (
          <div 
            key={num} 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 
              ${step > num ? 'bg-primary border-primary text-primary-foreground' : 
                step === num ? 'bg-background border-primary text-primary' : 
                'bg-background border-muted text-muted-foreground'}`}
          >
            {step > num ? <CheckCircle2 className="h-5 w-5" /> : num}
          </div>
        ))}
      </div>

      {/* Step 1: Confirmación */}
      {step === 1 && (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-6 md:p-8 space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Confirma tu horario</h2>
              <p className="text-muted-foreground mt-1">Revisa los datos de tu reserva antes de continuar.</p>
            </div>

            <div className="bg-muted/30 rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-lg">{booking.courtName} - {booking.venueName}</p>
                  <p className="text-muted-foreground">{booking.venueAddress}, {booking.venueCity}</p>
                </div>
              </div>
              <div className="h-px bg-border/50 w-full" />
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <p className="capitalize font-medium">{displayDate}</p>
              </div>
              <div className="h-px bg-border/50 w-full" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary shrink-0" />
                  <p className="font-medium">{booking.time} hs <span className="text-muted-foreground font-normal">(1 hora)</span></p>
                </div>
              </div>
              <div className="h-px bg-border/50 w-full" />
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5 text-primary shrink-0" />
                <div className="w-full flex items-center justify-between">
                  <p className="font-medium">Monto Total</p>
                  <p className="font-bold text-lg text-primary">${booking.price.toLocaleString('es-AR')}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={async () => {
                  setLoading(true)
                  try {
                    const { cancelPendingBooking } = await import('@/app/actions/booking')
                    await cancelPendingBooking((booking.id || ''))
                  } catch (e) {
          console.log((e as Error).message);
                    console.error(e)
                  }
                  router.back()
                }} 
                disabled={loading}
              >
                Cancelar
              </Button>
              {requireDeposit ? (
                <Button className="w-full" onClick={handleNext}>
                  Continuar <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button className="w-full" onClick={handlePayment} disabled={loading}>
                  {loading ? "Confirmando..." : "Confirmar Reserva"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Resumen y Pago */}
      {step === 2 && (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-6 md:p-8 space-y-8">
            <div>
              <h2 className="text-2xl font-bold">Resumen de Pago</h2>
              <p className="text-muted-foreground mt-1">Para confirmar la reserva debes abonar la seña (30%).</p>
            </div>

            {/* Desglose */}
            <div className="space-y-4 bg-muted/20 p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Precio Total</span>
                <span className="font-medium text-foreground">${booking.price.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Resto a pagar en el complejo</span>
                <span className="font-medium text-foreground">${remainingAmount.toLocaleString('es-AR')}</span>
              </div>
              <div className="h-px bg-border/50 w-full my-2" />
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total a pagar ahora (Seña)</span>
                <span className="text-primary">${depositAmount.toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Método de pago */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Método de Pago</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  aria-pressed={paymentMethod === 'transfer'}
                  className={`text-left border rounded-xl p-4 transition-all ${paymentMethod === 'transfer' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border/50 hover:bg-muted/50'}`}
                  onClick={() => setPaymentMethod('transfer')}
                >
                  <Banknote className={`h-6 w-6 mb-3 ${paymentMethod === 'transfer' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="font-semibold text-sm">Transferencia</p>
                  <p className="text-xs text-muted-foreground mt-1">Alias / CBU del complejo. Enviás el comprobante por el chat.</p>
                </button>

                <div
                  aria-disabled="true"
                  className="border border-border/50 rounded-xl p-4 opacity-60 cursor-not-allowed relative"
                >
                  <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-1 rounded-full">
                    Próximamente
                  </span>
                  <CreditCard className="h-6 w-6 mb-3 text-muted-foreground" />
                  <p className="font-semibold text-sm text-muted-foreground">Mercado Pago</p>
                  <p className="text-xs text-muted-foreground mt-1">Tarjetas de crédito, débito o dinero en cuenta.</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-md" aria-live="polite">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="w-full" onClick={handleBack} disabled={loading}>
                Volver
              </Button>
              <Button className="w-full" onClick={handlePayment} disabled={loading}>
                {loading ? "Reservando..." : "Reservar y ver datos de pago"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
