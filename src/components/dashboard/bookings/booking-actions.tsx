/* eslint-disable jsx-a11y/label-has-associated-control */
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Check, X, CreditCard, Receipt } from "lucide-react"
import {
  updateBookingStatus,
  updatePaymentStatus,
  confirmTransferPayment,
  rejectTransferPayment,
} from "@/app/dashboard/bookings/actions"

export function BookingActions({ bookingId, status, paymentStatus }: { bookingId: string, status: string, paymentStatus: string }) {
  const [loading, setLoading] = useState(false)

  const runAction = async (action: () => Promise<void>) => {
    setLoading(true)
    try {
      await action()
    } catch (error: unknown) {
      alert("Error: " + (error instanceof Error ? error.message : "Desconocido"))
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: unknown) => {
    setLoading(true)
    try {
      // @ts-expect-error fix inference
      await updateBookingStatus(bookingId, newStatus)
    } catch (error: unknown) {
      alert("Error: " + (error instanceof Error ? error.message : "Desconocido"))
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentChange = async (newStatus: unknown) => {
    setLoading(true)
    try {
      // @ts-expect-error fix inference
      await updatePaymentStatus(bookingId, newStatus)
    } catch (error: unknown) {
      alert("Error: " + (error instanceof Error ? error.message : "Desconocido"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading}>
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      } />
      <DropdownMenuContent align="end">
        {paymentStatus === 'awaiting_verification' && status !== 'cancelled' && (
          <>
            <DropdownMenuItem onClick={() => runAction(() => confirmTransferPayment(bookingId))}>
              <Receipt className="mr-2 h-4 w-4" />
              Confirmar transferencia
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => runAction(() => rejectTransferPayment(bookingId))}
              className="text-red-600"
            >
              <X className="mr-2 h-4 w-4" />
              Rechazar comprobante
            </DropdownMenuItem>
          </>
        )}
        {status !== 'cancelled' && (
          <DropdownMenuItem onClick={() => handleStatusChange('cancelled')} className="text-red-600">
            <X className="mr-2 h-4 w-4" />
            Cancelar Reserva
          </DropdownMenuItem>
        )}
        {status !== 'completed' && status !== 'cancelled' && (
          <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
            <Check className="mr-2 h-4 w-4" />
            Marcar Completada
          </DropdownMenuItem>
        )}
        {paymentStatus !== 'paid' && status !== 'cancelled' && (
          <DropdownMenuItem onClick={() => handlePaymentChange('paid')}>
            <CreditCard className="mr-2 h-4 w-4" />
            Marcar como Pagado
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
