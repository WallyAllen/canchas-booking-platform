"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Star, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface VenueCardProps {
  venue: {
    id: string
    name: string
    address: string
    city: string
    avg_rating: number
    review_count: number
    featured_image: string | null
    require_deposit?: boolean
  }
  minPrice: number
  courtTypes: string[]
  className?: string
}

export function VenueCard({ venue, minPrice, courtTypes, className }: VenueCardProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <Link href={`/venue/${venue.id}`} className={cn("block group", className)}>
      <Card className="overflow-hidden h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-card border-border/50">
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {venue.featured_image && !imgError ? (
            <Image
              src={venue.featured_image}
              alt={venue.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
              <span className="text-4xl opacity-20">⚽</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1">
            {courtTypes.map((type) => (
              <Badge key={type} variant="secondary" className="bg-background/80 backdrop-blur-xs text-xs font-semibold">
                {type}
              </Badge>
            ))}
          </div>
          <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-xs px-2 py-1 rounded-md flex items-center gap-1 text-sm font-medium shadow-xs">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span>{venue.avg_rating.toFixed(1)}</span>
            <span className="text-muted-foreground text-xs">({venue.review_count})</span>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">{venue.name}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{venue.address}, {venue.city}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/50">
            {venue.require_deposit !== undefined ? (
              <span className={cn("text-xs font-medium flex items-center gap-1.5", venue.require_deposit ? "text-primary" : "text-muted-foreground")}>
                <span className={cn("w-1.5 h-1.5 rounded-full", venue.require_deposit ? "bg-primary" : "bg-muted-foreground/50")} />
                {venue.require_deposit ? "Con seña" : "Sin seña"}
              </span>
            ) : <div />}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-muted-foreground">Desde</span>
              <span className="font-semibold text-base text-foreground leading-none">${minPrice.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
