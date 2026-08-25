/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { CalendarIcon, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { CourtItem } from "./CourtList"

interface AvailabilityGridProps {
  venueId: string
  courts: CourtItem[]
}

export function AvailabilityGrid({ venueId, courts }: AvailabilityGridProps) {
  const router = useRouter()
  const supabase = createClient()
  
  // Format Date to YYYY-MM-DD local
  const getLocalDateString = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, -1)
    return localISOTime.split('T')[0]
  }

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const dateStr = getLocalDateString(selectedDate)

  // Hardcode hours for MVP: 14:00 to 23:00 (10 slots of 1 hour)
  const hours = Array.from({ length: 10 }, (_, i) => i + 14)

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("court_id, start_time, status")
          .in("court_id", courts.map(c => c.id))
          .eq("booking_date", dateStr)
          .neq("status", "cancelled")
          
        if (error) throw error
        setBookings(data || [])
      } catch (error) {
        console.error("Error fetching bookings:", error)
      } finally {
        setLoading(false)
      }
    }

    if (courts.length > 0) {
      fetchBookings()
    }
  }, [dateStr, courts, supabase])

  const nextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setSelectedDate(next)
  }

  const prevDay = () => {
    const prev = new Date(selectedDate)
    const today = new Date()
    today.setHours(0,0,0,0)
    
    prev.setDate(prev.getDate() - 1)
    if (prev >= today) {
      setSelectedDate(prev)
    }
  }

  const handleSlotClick = (courtId: string, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:00:00`
    router.push(`/booking/${courtId}?date=${dateStr}&time=${timeStr}`)
  }

  // Format date nicely
  const displayDate = selectedDate.toLocaleDateString('es-AR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  })

  // Disable prev button if it's today
  const isToday = getLocalDateString(selectedDate) === getLocalDateString(new Date())

  return (
    <div id="availability-grid" className="space-y-6 scroll-mt-24">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h3 className="text-xl font-bold">Disponibilidad</h3>
        
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
          <Button variant="ghost" size="icon" onClick={prevDay} disabled={isToday || loading} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-1 text-sm font-medium capitalize min-w-[200px] justify-center">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            {displayDate}
          </div>
          <Button variant="ghost" size="icon" onClick={nextDay} disabled={loading} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative border border-border/50 rounded-xl overflow-hidden bg-card">
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[800px]">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium w-[200px] border-b border-r border-border/50 sticky left-0 bg-muted/90 backdrop-blur z-20">
                  Cancha
                </th>
                {hours.map((hour) => (
                  <th key={hour} className="px-4 py-3 font-medium text-center border-b border-border/50 min-w-[80px]">
                    {hour}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium border-r border-border/50 sticky left-0 bg-card z-10">
                    {court.name}
                    <div className="text-[10px] text-muted-foreground font-normal">{court.type} - {court.surface}</div>
                  </td>
                  
                  {hours.map((hour) => {
                    const timeStr = `${hour.toString().padStart(2, '0')}:00:00`
                    const isBooked = bookings.some(
                      b => b.court_id === court.id && b.start_time === timeStr
                    )
                    
                    // Comprobar si la hora ya pasó (si es hoy)
                    const now = new Date()
                    const isPast = isToday && hour <= now.getHours()

                    return (
                      <td key={hour} className="p-1 border-r border-border/50 last:border-0">
                        {isPast ? (
                          <div className="h-10 w-full bg-muted/50 rounded flex items-center justify-center text-muted-foreground/50 text-xs cursor-not-allowed">
                            -
                          </div>
                        ) : isBooked ? (
                          <div className="h-10 w-full bg-red-500/10 border border-red-500/20 text-red-500 rounded flex items-center justify-center text-xs font-medium cursor-not-allowed">
                            Ocupado
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSlotClick(court.id, hour)}
                            className="h-10 w-full bg-primary/10 hover:bg-primary border border-primary/20 hover:border-primary text-primary hover:text-primary-foreground transition-colors rounded flex items-center justify-center text-xs font-semibold cursor-pointer"
                          >
                            Libre
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex items-center justify-end gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30"></div> Libre
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20"></div> Ocupado
        </div>
      </div>
    </div>
  )
}
