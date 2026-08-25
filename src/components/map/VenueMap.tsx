import dynamic from "next/dynamic"
import { SearchVenueItem } from "@/components/search/VenueList"
import { Loader2 } from "lucide-react"

// Importamos dinámicamente para evitar que Next.js intente renderizar Leaflet en el servidor (lo cual falla porque requiere 'window')
const VenueMapClient = dynamic(() => import("./VenueMapClient"), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-muted/20 flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground font-medium">Cargando mapa...</p>
    </div>
  )
})

interface VenueMapProps {
  venues: SearchVenueItem[]
  hoveredVenueId?: string | null
}

export function VenueMap(props: VenueMapProps) {
  return <VenueMapClient {...props} />
}
