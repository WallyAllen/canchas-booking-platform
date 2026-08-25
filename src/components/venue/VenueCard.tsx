import Link from "next/link"
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
  }
  minPrice: number
  courtTypes: string[]
  className?: string
}

export function VenueCard({ venue, minPrice, courtTypes, className }: VenueCardProps) {
  return (
    <Link href={`/venue/${venue.id}`} className={cn("block group", className)}>
      <Card className="overflow-hidden h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-card border-border/50">
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {venue.featured_image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={venue.featured_image}
              alt={venue.name}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
              <span className="text-4xl opacity-20">⚽</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1">
            {courtTypes.map((type) => (
              <Badge key={type} variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs font-semibold">
                {type}
              </Badge>
            ))}
          </div>
          <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 text-sm font-medium shadow-sm">
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
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Precio por turno</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-muted-foreground">desde</span>
              <span className="font-bold text-lg text-primary">${minPrice.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
