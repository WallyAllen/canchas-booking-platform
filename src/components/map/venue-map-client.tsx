"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import Link from "next/link"
import { SearchVenueItem } from "@/components/search/venue-list"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"
import { useGeolocation } from "@/hooks/useGeolocation"

// Fix for default marker icons in Leaflet with Webpack/Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const activeIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const userIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

L.Marker.prototype.options.icon = defaultIcon

interface VenueMapClientProps {
  venues: SearchVenueItem[]
  hoveredVenueId?: string | null
}

// Component to dynamically adjust map bounds based on markers
function MapBounds({ venues, userLocation }: { venues: SearchVenueItem[], userLocation: { lat: number, lng: number } | null }) {
  const map = useMap()
  
  useEffect(() => {
    if (venues.length === 0 && !userLocation) return
    
    const bounds = L.latLngBounds([])
    
    venues.forEach(v => {
      if (v.latitude && v.longitude) {
        bounds.extend([v.latitude, v.longitude])
      }
    })
    
    if (userLocation) {
      bounds.extend([userLocation.lat, userLocation.lng])
    }
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }, [venues, userLocation, map])
  
  return null
}

export default function VenueMapClient({ venues, hoveredVenueId }: VenueMapClientProps) {
  const { latitude: userLat, longitude: userLng } = useGeolocation()
  // Centro inicial: La Plata
  const defaultCenter: [number, number] = [-34.9205, -57.9536]
  
  const userLocation = userLat && userLng ? { lat: userLat, lng: userLng } : null

  return (
    <div className="h-full w-full bg-muted/20 relative z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>Estás aquí</Popup>
          </Marker>
        )}

        {venues.map(venue => {
          if (!venue.latitude || !venue.longitude) return null
          
          const isHovered = hoveredVenueId === venue.id
          
          return (
            <Marker 
              key={venue.id} 
              position={[venue.latitude, venue.longitude]}
              icon={isHovered ? activeIcon : defaultIcon}
              zIndexOffset={isHovered ? 1000 : 0}
            >
              <Popup className="venue-popup">
                <div className="p-1 max-w-[200px]">
                  <h4 className="font-bold text-sm mb-1 line-clamp-1">{venue.name}</h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{venue.avg_rating.toFixed(1)}</span>
                    <span>({venue.review_count})</span>
                  </div>
                  <p className="text-xs font-semibold text-primary mb-3">
                    Desde ${venue.min_price.toLocaleString('es-AR')}
                  </p>
                  <Button render={<Link href={`/venue/${venue.id}`} />} size="sm" className="w-full h-8 text-xs">
                    Ver complejo
                  </Button>
                </div>
              </Popup>
            </Marker>
          )
        })}
        
        <MapBounds venues={venues} userLocation={userLocation} />
      </MapContainer>
      
      {/* Añadir estilos para el popup */}
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container {
          font-family: inherit;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        }
        .leaflet-popup-content {
          margin: 12px;
        }
        /* Make dark mode friendly */
        .dark .leaflet-popup-content-wrapper,
        .dark .leaflet-popup-tip {
          background-color: hsl(var(--card));
          color: hsl(var(--card-foreground));
        }
        .dark .leaflet-container a.leaflet-popup-close-button {
          color: hsl(var(--muted-foreground));
        }
      `}} />
    </div>
  )
}
