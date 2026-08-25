"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight, Clock, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export interface PromoItem {
  id: string
  venue_id: string
  venue_name: string
  court_name: string
  original_price: number
  promo_price: number
  start_time: string
  end_time: string
  date: string
}

interface PromoCarouselProps {
  promos: PromoItem[]
}

export function PromoCarousel({ promos }: PromoCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (!promos || promos.length === 0) return null

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300 // approx card width
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  // Helper to format time (e.g. "18:00:00" -> "18:00")
  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5)
  }

  return (
    <div className="relative group">
      <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-10 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="outline" size="icon" className="rounded-full shadow-md bg-background" onClick={() => scroll('left')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 pt-2 px-2 scrollbar-hide -mx-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {promos.map((promo) => (
          <Link 
            key={`${promo.id}-${promo.start_time}`} 
            href={`/venue/${promo.venue_id}?date=${promo.date}`}
            className="shrink-0 w-[280px] snap-center block transition-transform hover:scale-[1.02]"
          >
            <Card className="h-full border-primary/30 bg-primary/5 overflow-hidden">
              <div className="bg-primary/20 px-3 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
                  <Tag className="h-3.5 w-3.5" />
                  <span>Oferta Relámpago</span>
                </div>
                <Badge variant="destructive" className="text-[10px] px-1.5 h-4 bg-red-500">
                  -{Math.round((1 - promo.promo_price / promo.original_price) * 100)}%
                </Badge>
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h4 className="font-bold text-base line-clamp-1">{promo.venue_name}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-1">{promo.court_name}</p>
                </div>
                
                <div className="flex items-center gap-2 bg-background/50 rounded-md p-2 border border-border/50">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Hoy, {formatTime(promo.start_time)} - {formatTime(promo.end_time)}
                  </span>
                </div>
                
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm text-muted-foreground line-through">
                    ${promo.original_price.toLocaleString('es-AR')}
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    ${promo.promo_price.toLocaleString('es-AR')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-10 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="outline" size="icon" className="rounded-full shadow-md bg-background" onClick={() => scroll('right')}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
      `}} />
    </div>
  )
}
