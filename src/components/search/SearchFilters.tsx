"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SlidersHorizontal, Search } from "lucide-react"

export function SearchFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get("q") || "")
  const [date, setDate] = useState(searchParams.get("date") || "")
  
  // Local state for filters
  const [type, setType] = useState(searchParams.get("type") || "")
  const [surface, setSurface] = useState(searchParams.get("surface") || "")
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "")
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "")
  const [minRating, setMinRating] = useState(searchParams.get("minRating") || "")

  // Actualizar si cambia la URL por fuera
  useEffect(() => {
    setQuery(searchParams.get("q") || "")
    setDate(searchParams.get("date") || "")
    setType(searchParams.get("type") || "")
    setSurface(searchParams.get("surface") || "")
    setMinPrice(searchParams.get("minPrice") || "")
    setMaxPrice(searchParams.get("maxPrice") || "")
    setMinRating(searchParams.get("minRating") || "")
  }, [searchParams])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (date) params.set("date", date)
    if (type) params.set("type", type)
    if (surface) params.set("surface", surface)
    if (minPrice) params.set("minPrice", minPrice)
    if (maxPrice) params.set("maxPrice", maxPrice)
    if (minRating) params.set("minRating", minRating)
    
    router.push(`/search?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push("/search")
  }

  return (
    <div className="bg-card border-border/50 border rounded-xl p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          Filtros
        </h3>
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-8 text-muted-foreground hover:text-foreground">
          Limpiar
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Búsqueda</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Nombre o zona..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input 
            type="date"
            value={date}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="[color-scheme:dark]"
          />
        </div>

        <div className="space-y-2">
          <Label>Tipo de Cancha</Label>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Cualquiera</option>
            <option value="F5">Fútbol 5</option>
            <option value="F7">Fútbol 7</option>
            <option value="F8">Fútbol 8</option>
            <option value="F11">Fútbol 11</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Superficie</Label>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
          >
            <option value="">Cualquiera</option>
            <option value="sintetico">Césped Sintético</option>
            <option value="natural">Césped Natural</option>
            <option value="hormigon">Hormigón / Cemento</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Precio por turno</Label>
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              placeholder="Mín" 
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <span className="text-muted-foreground">-</span>
            <Input 
              type="number" 
              placeholder="Máx" 
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Valoración mínima</Label>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="4.5">4.5+ Estrellas</option>
            <option value="4.0">4.0+ Estrellas</option>
            <option value="3.0">3.0+ Estrellas</option>
          </select>
        </div>
      </div>

      <Button className="w-full" onClick={applyFilters}>
        Aplicar Filtros
      </Button>
    </div>
  )
}
