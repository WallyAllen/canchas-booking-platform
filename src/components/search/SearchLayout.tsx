"use client"

import { useState } from "react"
import { SearchVenueItem, VenueList } from "./VenueList"
import { SearchFilters } from "./SearchFilters"
import { VenueMap } from "@/components/map/VenueMap"
import { Button } from "@/components/ui/button"
import { MapIcon, List, SlidersHorizontal } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

interface SearchLayoutProps {
  venues: SearchVenueItem[]
}

export function SearchLayout({ venues }: SearchLayoutProps) {
  const [view, setView] = useState<'map' | 'list'>('list')
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Header bar / Mobile toggle */}
      <div className="flex-none bg-background border-b border-border/50 px-4 py-3 flex items-center justify-between z-10">
        <div>
          <h1 className="text-xl font-bold">Resultados</h1>
          <p className="text-sm text-muted-foreground">
            {venues.length} {venues.length === 1 ? 'cancha encontrada' : 'canchas encontradas'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filters mobile toggle */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger render={
                <Button variant="outline" size="sm" className="h-9">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              } />
              <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto">
                <SheetTitle className="sr-only">Filtros de Búsqueda</SheetTitle>
                <div className="mt-6">
                  <SearchFilters />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* View toggle mobile */}
          <div className="md:hidden bg-muted p-1 rounded-lg flex">
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

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Filters (Sidebar left or top? Let's put them on top or in list panel) */}
        {/* The instructions say: "Desktop: mapa a la izquierda (50%) + lista a la derecha (50%)". Let's do that. */}
        
        {/* MAP PANEL */}
        <div className={`flex-1 md:w-1/2 md:flex flex-col relative ${view === 'map' ? 'flex' : 'hidden'}`}>
          <VenueMap venues={venues} hoveredVenueId={hoveredVenueId} />
        </div>

        {/* LIST PANEL */}
        <div className={`w-full md:w-1/2 md:flex flex-col border-l border-border/50 bg-background overflow-hidden ${view === 'list' ? 'flex' : 'hidden'}`}>
          <div className="hidden md:block p-4 border-b border-border/50 bg-muted/10">
            <SearchFilters />
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <VenueList 
              venues={venues} 
              onHoverVenue={setHoveredVenueId} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
