"use client"

import { VenueCard } from "@/components/venue/VenueCard"

export interface SearchVenueItem {
  id: string
  name: string
  address: string
  city: string
  avg_rating: number
  review_count: number
  featured_image: string | null
  latitude: number | null
  longitude: number | null
  min_price: number
  court_types: string[]
  require_deposit?: boolean
}

interface VenueListProps {
  venues: SearchVenueItem[]
  onHoverVenue?: (id: string | null) => void
}

export function VenueList({ venues, onHoverVenue }: VenueListProps) {
  if (!venues || venues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="bg-muted h-20 w-20 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">🏟️</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">No encontramos canchas</h3>
        <p className="text-muted-foreground max-w-sm">
          No hay complejos que coincidan con tus filtros actuales. Probá ampliando tu búsqueda o eliminando algunos filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
      {venues.map((venue) => (
        <div 
          key={venue.id}
          onMouseEnter={() => onHoverVenue?.(venue.id)}
          onMouseLeave={() => onHoverVenue?.(null)}
        >
          <VenueCard 
            venue={{
              id: venue.id,
              name: venue.name,
              address: venue.address,
              city: venue.city,
              avg_rating: venue.avg_rating,
              review_count: venue.review_count,
              featured_image: venue.featured_image,
              require_deposit: venue.require_deposit
            }}
            minPrice={venue.min_price}
            courtTypes={venue.court_types}
          />
        </div>
      ))}
    </div>
  )
}
