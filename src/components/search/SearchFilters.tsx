"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SlidersHorizontal, Search } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader, SheetFooter } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"

export function SearchFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState<string>(searchParams.get("q") || "")
  const [date, setDate] = useState<string>(searchParams.get("date") || "")
  const [time, setTime] = useState<string>(searchParams.get("time") || "")
  const [sort, setSort] = useState<string>(searchParams.get("sort") || "rating")
  
  // Advanced filters state
  const [type, setType] = useState<string>(searchParams.get("type") || "")
  const [surface, setSurface] = useState<string>(searchParams.get("surface") || "")
  const [minPrice, setMinPrice] = useState<string>(searchParams.get("minPrice") || "")
  const [maxPrice, setMaxPrice] = useState<string>(searchParams.get("maxPrice") || "")
  const [minRating, setMinRating] = useState<string>(searchParams.get("minRating") || "")
  const [requireDeposit, setRequireDeposit] = useState<string>(searchParams.get("requireDeposit") || "")

  const [isSheetOpen, setIsSheetOpen] = useState(false)



  // Sync state with URL
  useEffect(() => {
    setQuery(searchParams.get("q") || "")
    setDate(searchParams.get("date") || "")
    setTime(searchParams.get("time") || "")
    setSort(searchParams.get("sort") || "rating")
    setType(searchParams.get("type") || "")
    setSurface(searchParams.get("surface") || "")
    setMinPrice(searchParams.get("minPrice") || "")
    setMaxPrice(searchParams.get("maxPrice") || "")
    setMinRating(searchParams.get("minRating") || "")
    setRequireDeposit(searchParams.get("requireDeposit") || "")
  }, [searchParams])

  const activeFiltersCount = [type, surface, minPrice, maxPrice, minRating, requireDeposit].filter(Boolean).length

  const updateUrl = (overrides?: Record<string, string>) => {
    const params = new URLSearchParams()
    const finalQuery = overrides?.q !== undefined ? overrides.q : query
    const finalDate = overrides?.date !== undefined ? overrides.date : date
    const finalTime = overrides?.time !== undefined ? overrides.time : time
    const finalSort = overrides?.sort !== undefined ? overrides.sort : sort
    const finalType = overrides?.type !== undefined ? overrides.type : type
    const finalSurface = overrides?.surface !== undefined ? overrides.surface : surface
    const finalMinPrice = overrides?.minPrice !== undefined ? overrides.minPrice : minPrice
    const finalMaxPrice = overrides?.maxPrice !== undefined ? overrides.maxPrice : maxPrice
    const finalMinRating = overrides?.minRating !== undefined ? overrides.minRating : minRating
    const finalRequireDeposit = overrides?.requireDeposit !== undefined ? overrides.requireDeposit : requireDeposit

    if (finalQuery) params.set("q", finalQuery)
    if (finalDate && finalDate !== "any") params.set("date", finalDate)
    if (finalTime && finalTime !== "any") params.set("time", finalTime)
    if (finalSort && finalSort !== 'rating') params.set("sort", finalSort)
    if (finalType) params.set("type", finalType)
    if (finalSurface) params.set("surface", finalSurface)
    if (finalMinPrice) params.set("minPrice", finalMinPrice)
    if (finalMaxPrice) params.set("maxPrice", finalMaxPrice)
    if (finalMinRating) params.set("minRating", finalMinRating)
    if (finalRequireDeposit) params.set("requireDeposit", finalRequireDeposit)
    
    router.push(`/search?${params.toString()}`)
  }

  const applyAdvancedFilters = () => {
    updateUrl()
    setIsSheetOpen(false)
  }

  const clearAdvancedFilters = () => {
    setType("")
    setSurface("")
    setMinPrice("")
    setMaxPrice("")
    setMinRating("")
    setRequireDeposit("")
    updateUrl({ type: "", surface: "", minPrice: "", maxPrice: "", minRating: "", requireDeposit: "" })
    setIsSheetOpen(false)
  }

  return (
    <div className="flex flex-col gap-3 p-3 px-4 md:px-6 bg-background border-b border-border/50 sticky top-0 z-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
        {/* Quick Search */}
        <div className="relative w-full md:max-w-md xl:max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre o zona..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && updateUrl()}
            onBlur={() => updateUrl()}
            className="pl-9 bg-background w-full h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto pb-1 sm:pb-0">
          
          {/* Match Type Inline */}
          <div className="shrink-0 flex items-center w-[130px]">
            <Select 
              value={type} 
              onValueChange={(val) => {
                const newVal = val === "all" ? "" : (val || "")
                setType(newVal)
                updateUrl({ type: newVal })
              }}
            >
              <SelectTrigger className="h-9 w-full bg-background text-xs">
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

          {/* Custom Date Select */}
          <div className="shrink-0 flex items-center w-[140px]">
            <DatePicker
              value={date}
              onChange={(newVal) => {
                setDate(newVal)
                updateUrl({ date: newVal })
              }}
              placeholder="Cualquier día"
              formatStr="d MMM"
              className="h-9 text-xs w-full bg-background border-input"
            />
          </div>

          {/* Custom Time Select */}

          <div className="shrink-0 flex items-center w-[150px]">
            <TimePicker
              value={time}
              onChange={(newVal) => {
                setTime(newVal)
                updateUrl({ time: newVal })
              }}
              placeholder="Cualquier hora"
              className="h-9 text-xs w-full bg-background border-input"
            />
          </div>

          {/* Sort */}
          <div className="shrink-0 ml-1">
            <Select 
              value={sort} 
              onValueChange={(val: string | null) => {
                const newVal = val || "";
                setSort(newVal)
                updateUrl({ sort: newVal })
              }}
            >
              <SelectTrigger className="h-9 w-[140px] bg-background text-xs">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Mejor Valoración</SelectItem>
                <SelectItem value="price_asc">Menor Precio</SelectItem>
                <SelectItem value="price_desc">Mayor Precio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters Sheet */}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger render={<Button variant="outline" size="sm" className="h-9 shrink-0 relative px-3" />}>
              <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 h-5 text-[10px] min-w-[20px] flex items-center justify-center rounded-full bg-primary/20 text-primary">
                  {activeFiltersCount}
                </Badge>
              )}
            </SheetTrigger>
            <SheetContent side="right" className="w-screen sm:max-w-[400px] overflow-y-auto flex flex-col">
              <SheetHeader className="mb-6">
                <SheetTitle>Filtros Avanzados</SheetTitle>
              </SheetHeader>
              
              <div className="space-y-6 flex-1">
                <div className="space-y-3">
                  <Label>Superficie</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={surface}
                    onChange={(e) => setSurface(e.target.value)}
                  >
                    <option value="">Cualquiera</option>
                    <option value="sintetico">Césped Sintético</option>
                    <option value="natural">Césped Natural</option>
                    <option value="hormigon">Hormigón / Cemento</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <Label>Precio por turno</Label>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      placeholder="Mín ($)" 
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                      type="number" 
                      placeholder="Máx ($)" 
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Valoración mínima</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                  >
                    <option value="">Todas</option>
                    <option value="4.5">4.5+ Estrellas</option>
                    <option value="4.0">4.0+ Estrellas</option>
                    <option value="3.0">3.0+ Estrellas</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <Label>Seña obligatoria</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={requireDeposit}
                    onChange={(e) => setRequireDeposit(e.target.value)}
                  >
                    <option value="">Cualquiera</option>
                    <option value="true">Con seña</option>
                    <option value="false">Sin seña</option>
                  </select>
                </div>
              </div>

              <SheetFooter className="mt-8 flex-row gap-3 sm:justify-end">
                <Button variant="ghost" className="flex-1 sm:flex-none" onClick={clearAdvancedFilters}>Limpiar</Button>
                <Button className="flex-1 sm:flex-none" onClick={applyAdvancedFilters}>Mostrar Resultados</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  )
}
