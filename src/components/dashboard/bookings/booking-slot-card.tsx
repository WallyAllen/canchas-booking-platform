import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BookingActions } from "./booking-actions"

interface BookingSlotCardProps {
  booking: import("@/types/domain").BookingWithDetails
  onBookClick?: () => void
}

export function BookingSlotCard({ booking, onBookClick }: BookingSlotCardProps) {
  if (!booking) {
    return (
      <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-primary" onClick={onBookClick}>
          + Reservar
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      "p-3 rounded-md border text-sm shadow-sm flex flex-col gap-1 h-full",
      // @ts-expect-error fix inference
      booking.booking_status === 'cancelled' ? "bg-red-50 border-red-200" :
      // @ts-expect-error fix inference
      booking.booking_status === 'confirmed' ? "bg-green-50 border-green-200" :
      "bg-blue-50 border-blue-200"
    )}>
      <div className="flex justify-between items-start">
        {/* @ts-expect-error fix inference */}
        <span className="font-semibold truncate max-w-[120px]" title={booking.profiles?.full_name}>
          {booking.profiles?.full_name || 'Sin Nombre'}
        </span>
        <Badge variant="outline" className="text-[10px] px-1 h-4 bg-background/50 backdrop-blur-sm">
          {booking.payment_status === 'paid' ? 'Pagado' : 'Pend.'}
        </Badge>
      </div>
      
      {booking.profiles?.phone && (
        <span className="text-xs text-muted-foreground truncate">
          {booking.profiles.phone}
        </span>
      )}
      
      <div className="flex justify-between items-center mt-auto pt-2 border-t border-black/5">
        <span className="font-medium text-xs">
          ${booking.total_price.toLocaleString('es-AR')}
        </span>
        {/* @ts-expect-error fix inference */}
        <BookingActions bookingId={booking.id} status={booking.booking_status} paymentStatus={booking.payment_status} />
      </div>
    </div>
  )
}
