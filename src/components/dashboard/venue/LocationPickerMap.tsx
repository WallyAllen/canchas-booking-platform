"use client"

import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
})
L.Marker.prototype.options.icon = defaultIcon

interface LocationPickerProps {
  initialLat?: number
  initialLng?: number
  onChange: (lat: number, lng: number) => void
}

function LocationMarker({ position, setPosition, onChange }: { position: L.LatLng | null, setPosition: any, onChange: any }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng)
      onChange(e.latlng.lat, e.latlng.lng)
    },
  })

  const markerRef = useRef<L.Marker>(null)

  return position === null ? null : (
    <Marker 
      position={position} 
      draggable={true} 
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current
          if (marker != null) {
            const latlng = marker.getLatLng()
            setPosition(latlng)
            onChange(latlng.lat, latlng.lng)
          }
        }
      }}
    />
  )
}

export default function LocationPickerMap({ initialLat, initialLng, onChange }: LocationPickerProps) {
  const defaultCenter = L.latLng(initialLat || -34.9205, initialLng || -57.9536)
  const [position, setPosition] = useState<L.LatLng | null>(
    initialLat && initialLng ? L.latLng(initialLat, initialLng) : null
  )

  return (
    <div className="h-[300px] w-full rounded-md border overflow-hidden relative z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={14} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <LocationMarker position={position} setPosition={setPosition} onChange={onChange} />
      </MapContainer>
    </div>
  )
}
