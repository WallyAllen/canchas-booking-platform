"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [date, setDate] = useState("")
  const [timeRange, setTimeRange] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (date) params.set("date", date)
    if (timeRange) params.set("time", timeRange)
    
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-card/80 backdrop-blur-md rounded-2xl p-2 sm:p-3 shadow-2xl border border-border/50">
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
        
        {/* Búsqueda por Zona/Nombre */}
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <MapPin className="h-5 w-5" />
          </div>
          <Input
            type="text"
            placeholder="Barrio, ciudad o nombre del complejo..."
            className="pl-10 h-14 bg-background/50 border-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        {/* Separador Desktop */}
        <div className="hidden md:block w-px bg-border my-2" />

        {/* Fecha */}
        <div className="relative flex-1 md:max-w-[200px] group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Calendar className="h-5 w-5" />
          </div>
          <Input
            type="date"
            className="pl-10 h-14 bg-background/50 border-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base cursor-pointer [color-scheme:dark]"
            value={date}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Separador Desktop */}
        <div className="hidden md:block w-px bg-border my-2" />

        {/* Franja Horaria */}
        <div className="relative flex-1 md:max-w-[200px] group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Clock className="h-5 w-5" />
          </div>
          <select
            className="w-full h-14 pl-10 pr-8 rounded-md bg-background/50 border-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base appearance-none outline-none focus:outline-none transition-colors"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="" className="bg-background text-foreground">Cualquier horario</option>
            <option value="morning" className="bg-background text-foreground">Mañana (08:00 - 13:00)</option>
            <option value="afternoon" className="bg-background text-foreground">Tarde (13:00 - 18:00)</option>
            <option value="evening" className="bg-background text-foreground">Noche (18:00 - 00:00)</option>
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted-foreground">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819L7.43179 8.56819C7.60753 8.74393 7.89245 8.74393 8.06819 8.56819L10.5682 6.06819C10.7439 5.89245 10.7439 5.60753 10.5682 5.43179C10.3925 5.25605 10.1075 5.25605 9.93179 5.43179L7.75 7.61358L5.56819 5.43179C5.39245 5.25605 5.10753 5.25605 4.93179 5.43179Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
            </svg>
          </div>
        </div>

        {/* Botón Buscar */}
        <Button type="submit" size="lg" className="h-14 px-8 text-base font-semibold md:min-w-[140px]">
          <Search className="mr-2 h-5 w-5" />
          Buscar
        </Button>
      </form>
    </div>
  )
}
