"use client"

import dynamic from "next/dynamic"

const LocationPickerMap = dynamic(() => import("./location-picker-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full rounded-md border flex items-center justify-center bg-muted/20">
      <p className="text-sm text-muted-foreground">Cargando mapa...</p>
    </div>
  )
})

interface LocationPickerProps {
  initialLat?: number
  initialLng?: number
  onChange: (lat: number, lng: number) => void
}

export function LocationPicker(props: LocationPickerProps) {
    return <LocationPickerMap {...props} />
}
