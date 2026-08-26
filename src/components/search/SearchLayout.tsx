"use client"

import { useState } from "react"
import { SearchVenueItem, VenueList } from "./VenueList"
import { SearchFilters } from "./SearchFilters"
import { VenueMap } from "@/components/map/VenueMap"
import { Button } from "@/components/ui/button"
import { MapIcon, List } from "lucide-react"

interface SearchLayoutProps {
  venues: SearchVenueItem[]
}

export function SearchLayout({ venues }: SearchLayoutProps) {
  const [view, setView] = useState<'map' | 'list'>('list')
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(null)
  
  const currentYear = new Date().getFullYear()

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* View toggle mobile only header */}
      <div className="flex-none bg-background border-b border-border/50 px-4 py-3 flex items-center justify-between z-10 md:hidden">
        <div>
          <h1 className="text-xl font-bold">Resultados</h1>
          <p className="text-sm text-muted-foreground">
            {venues.length} {venues.length === 1 ? 'cancha encontrada' : 'canchas encontradas'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View toggle mobile */}
          <div className="bg-muted p-1 rounded-lg flex">
            <Button 
              variant={view === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 text-xs px-3"
              onClick={() => setView('list')}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              Lista
            </Button>
            <Button 
              variant={view === 'map' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 text-xs px-3"
              onClick={() => setView('map')}
            >
              <MapIcon className="h-3.5 w-3.5 mr-1" />
              Mapa
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-none w-full z-20 bg-background">
        <SearchFilters />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LIST PANEL */}
        <div className={`w-full md:w-[55%] lg:w-1/2 md:flex flex-col border-r border-border/50 bg-background overflow-hidden ${view === 'list' ? 'flex' : 'hidden'}`}>
          <div className="flex-1 overflow-y-auto p-4 relative flex flex-col">
            <div className="hidden md:block mb-4">
              <h2 className="text-xl font-bold tracking-tight">Resultados de la búsqueda</h2>
              <p className="text-sm text-muted-foreground">{venues.length} predios encontrados según tus criterios.</p>
            </div>
            
            <VenueList 
              venues={venues} 
              onHoverVenue={setHoveredVenueId} 
            />

            {/* Mini Footer - Legal Links inside the scrollable list */}
            <div className="mt-auto pt-10 pb-4">
              <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                <p>© {currentYear} El Potrero.</p>
                <div className="flex space-x-4">
                  <a href="/terminos" className="hover:text-foreground transition-colors">Términos</a>
                  <a href="/privacidad" className="hover:text-foreground transition-colors">Privacidad</a>
                  <a href="/contacto" className="hover:text-foreground transition-colors">Contacto</a>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* MAP PANEL */}
        <div className={`flex-1 md:w-[45%] lg:w-1/2 md:flex flex-col relative ${view === 'map' ? 'flex' : 'hidden'}`}>
          <VenueMap venues={venues} hoveredVenueId={hoveredVenueId} />
        </div>
      </div>
    </div>
  )
}
