"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, addDays } from "date-fns"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [date, setDate] = useState("")
  const [timeRange, setTimeRange] = useState("")
  const [matchType, setMatchType] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd")

  useGSAP(() => {
    gsap.fromTo(
      containerRef.current,
      { y: 40, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 1, ease: "power3.out", delay: 0.3 }
    )
  }, { scope: containerRef })

  const handleSearch = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (matchType && matchType !== "all") params.set("type", matchType)
    if (date) params.set("date", date)
    if (timeRange) params.set("time", timeRange)
    
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div ref={containerRef} className="hero-search-container w-full max-w-5xl mx-auto bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl p-2 sm:p-3 invisible">
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
        
        {/* Búsqueda por Zona/Nombre */}
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <MapPin className="h-5 w-5" />
          </div>
          <Input
            type="text"
            placeholder="Buscar por nombre o zona..."
            className="pl-10 h-14 bg-background/50 border-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        {/* Separador Desktop */}
        <div className="hidden md:block w-px bg-border my-2" />

        {/* Tipo de Partido */}
        <div className="relative flex-1 md:max-w-[140px] group flex items-center h-14">
          <Select value={matchType} onValueChange={(val) => setMatchType(val || "")}>
            <SelectTrigger className="h-full w-full bg-background/50 border-0 focus:ring-1 focus:ring-primary focus:ring-offset-0 text-base">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cualquiera</SelectItem>
              <SelectItem value="F5">Fútbol 5</SelectItem>
              <SelectItem value="F6">Fútbol 6</SelectItem>
              <SelectItem value="F7">Fútbol 7</SelectItem>
              <SelectItem value="F8">Fútbol 8</SelectItem>
              <SelectItem value="F9">Fútbol 9</SelectItem>
              <SelectItem value="F11">Fútbol 11</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Separador Desktop */}
        <div className="hidden md:block w-px bg-border my-2" />

        {/* Fecha */}
        <div className="relative flex-1 md:max-w-[280px] lg:max-w-[320px] group flex items-center bg-background/50 rounded-md p-1 gap-1 focus-within:ring-1 focus-within:ring-primary focus-within:ring-offset-0 transition-colors">
          <Button
            type="button"
            variant={date === todayStr ? "secondary" : "ghost"}
            className="flex-1 h-12 px-2 text-sm font-medium rounded-sm hover:bg-background"
            onClick={() => setDate(todayStr)}
          >
            Hoy
          </Button>
          <Button
            type="button"
            variant={date === tomorrowStr ? "secondary" : "ghost"}
            className="flex-1 h-12 px-2 text-sm font-medium rounded-sm hover:bg-background"
            onClick={() => setDate(tomorrowStr)}
          >
            Mañana
          </Button>
          <div className="w-px h-6 bg-border/50 mx-1" />
          <div className="flex-[1.2] min-w-0 h-12">
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="Fecha"
              formatStr="d MMM"
              className="h-full w-full bg-transparent hover:bg-background border-0 shadow-none text-sm font-medium px-2 rounded-sm"
            />
          </div>
        </div>

        {/* Separador Desktop */}
        <div className="hidden md:block w-px bg-border my-2" />

        {/* Franja Horaria */}
        <div className="relative flex-1 md:max-w-[160px] group flex items-center h-14">
          <TimePicker
            value={timeRange}
            onChange={setTimeRange}
            placeholder="Cualquier hora"
            className="h-full w-full bg-background/50 text-base rounded-md"
          />
        </div>

        {/* Botón Buscar */}
        <Button type="submit" onClick={handleSearch} size="lg" className="h-14 px-8 text-base font-semibold md:min-w-[120px]">
          <Search className="mr-2 h-5 w-5" />
          Buscar
        </Button>
      </form>
    </div>
  )
}
