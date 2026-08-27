"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookingActions } from "@/components/dashboard/bookings/BookingActions"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button, buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, ArrowUpDown, LayoutList, Grid } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Booking {
  id: string
  court_id: string
  booking_date: string
  start_time: string
  end_time: string
  total_price: number
  booking_status: string
  payment_status: string
  courts?: { name: string }
  profiles?: { full_name: string; email: string; phone: string }
}

export interface Court {
  id: string
  name: string
}

interface BookingsClientProps {
  initialBookings: Booking[]
  courts: Court[]
}

type SortKey = 'booking_date' | 'courts.name' | 'profiles.full_name' | 'booking_status' | 'total_price'
type SortDirection = 'asc' | 'desc'

export function BookingsClient({ initialBookings, courts }: BookingsClientProps) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'booking_date',
    direction: 'desc'
  })

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedBookings = useMemo(() => {
    return [...initialBookings].sort((a, b) => {
      let aValue: unknown = a[sortConfig.key as keyof Booking]
      let bValue: unknown = b[sortConfig.key as keyof Booking]

      if (sortConfig.key === 'courts.name') {
        aValue = a.courts?.name
        bValue = b.courts?.name
      } else if (sortConfig.key === 'profiles.full_name') {
        aValue = a.profiles?.full_name || ''
        bValue = b.profiles?.full_name || ''
      } else if (sortConfig.key === 'booking_date') {
        aValue = new Date(`${a.booking_date}T${a.start_time}`).getTime()
        bValue = new Date(`${b.booking_date}T${b.start_time}`).getTime()
      }

      if ((aValue as number | string) < (bValue as number | string)) return sortConfig.direction === 'asc' ? -1 : 1
      if ((aValue as number | string) > (bValue as number | string)) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [initialBookings, sortConfig])

  const gridBookings = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    return initialBookings.filter(b => b.booking_date === dateStr)
  }, [initialBookings, selectedDate])

  // Generate time slots (14:00 to 23:30)
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = 14; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
    return slots
  }, [])

  const getBookingForSlot = (courtId: string, time: string) => {
    return gridBookings.find(b => {
      const start = b.start_time.substring(0, 5)
      return b.court_id === courtId && start === time
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'grid')} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <LayoutList className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <Grid className="h-4 w-4" />
              Grilla (Horarios)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {viewMode === 'grid' && (
          <Popover>
            <PopoverTrigger className={buttonVariants({ variant: "outline", className: cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground") })}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted" onClick={() => handleSort('booking_date')}>
                      <div className="flex items-center gap-1">Fecha y Hora <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted" onClick={() => handleSort('courts.name')}>
                      <div className="flex items-center gap-1">Cancha <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted" onClick={() => handleSort('profiles.full_name')}>
                      <div className="flex items-center gap-1">Cliente <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted" onClick={() => handleSort('booking_status')}>
                      <div className="flex items-center gap-1">Estado <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted" onClick={() => handleSort('total_price')}>
                      <div className="flex items-center gap-1">Monto <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="px-6 py-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedBookings.length > 0 ? sortedBookings.map((booking: Booking) => (
                    <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString('es-AR')}</div>
                        <div className="text-muted-foreground">{booking.start_time.substring(0, 5)} hs</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.courts?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{booking.profiles?.full_name || 'Sin Nombre'}</div>
                        <div className="text-xs text-muted-foreground">{booking.profiles?.phone || 'Sin teléfono'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline" className={
                          booking.booking_status === 'cancelled' ? 'border-red-200 text-red-700 bg-red-50' : 
                          booking.booking_status === 'confirmed' ? 'border-green-200 text-green-700 bg-green-50' : 
                          'border-blue-200 text-blue-700 bg-blue-50'
                        }>
                          {booking.booking_status === 'confirmed' ? 'Confirmada' : 
                           booking.booking_status === 'cancelled' ? 'Cancelada' : 
                           booking.booking_status === 'completed' ? 'Completada' : 'No Show'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">${booking.total_price.toLocaleString('es-AR')}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {booking.payment_status === 'paid' ? 'Pagado' : 
                           booking.payment_status === 'pending' ? 'Pendiente' : booking.payment_status}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-muted-foreground">
                        <BookingActions bookingId={booking.id} status={booking.booking_status} paymentStatus={booking.payment_status} />
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                        No hay reservas registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-3 border-b border-r bg-muted/30 font-medium text-muted-foreground w-24 sticky left-0 z-10 backdrop-blur-sm">Hora</th>
                  {courts.map(court => (
                    <th key={court.id} className="p-3 border-b bg-muted/10 font-medium min-w-[200px] text-center">
                      {court.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((time) => (
                  <tr key={time} className="group">
                    <td className="p-3 border-b border-r text-center font-medium text-muted-foreground sticky left-0 bg-background z-10 group-hover:bg-muted/30 transition-colors">
                      {time}
                    </td>
                    {courts.map(court => {
                      const booking = getBookingForSlot(court.id, time)
                      
                      return (
                        <td key={`${court.id}-${time}`} className="p-2 border-b border-r last:border-r-0 relative group-hover:bg-muted/10 transition-colors align-top h-24">
                          {booking ? (
                            <div className={cn(
                              "p-3 rounded-md border text-sm shadow-sm flex flex-col gap-1 h-full",
                              booking.booking_status === 'cancelled' ? "bg-red-50 border-red-200" :
                              booking.booking_status === 'confirmed' ? "bg-green-50 border-green-200" :
                              "bg-blue-50 border-blue-200"
                            )}>
                              <div className="flex justify-between items-start">
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
                                <BookingActions bookingId={booking.id} status={booking.booking_status} paymentStatus={booking.payment_status} />
                              </div>
                            </div>
                          ) : (
                            <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-primary">
                                + Reservar
                              </Button>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
