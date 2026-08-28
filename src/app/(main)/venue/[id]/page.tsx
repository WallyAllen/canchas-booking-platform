/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation"
import { createPublicClient } from "@/lib/supabase/public"
import { unstable_cache } from "next/cache"
import { VenueGallery } from "@/components/venue/VenueGallery"
import { CourtList, CourtItem } from "@/components/venue/CourtList"
import { AvailabilityGrid } from "@/components/venue/AvailabilityGrid"
import { PricingTable, PricingRule } from "@/components/venue/PricingTable"
import { ReviewSection, ReviewItem } from "@/components/venue/ReviewSection"
import { VenueMap } from "@/components/map/VenueMap"
import { PlayerChatModal } from "@/components/chat/PlayerChatModal"
import { MapPin, Phone, CheckCircle2, Loader2 } from "lucide-react"
import { Suspense } from "react"
import type { Metadata, ResolvingMetadata } from "next"

// Data fetching function wrapped in unstable_cache for high-performance ISR
const getVenueData = unstable_cache(
  async (id: string) => {
    const supabase = createPublicClient()
    
    // 1. Fetch Venue data
    const { data: venue, error: venueError } = await (supabase.from("venues") as any)
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single()

    if (venueError || !venue) return null

    // 2. Fetch Courts
    const { data: courtsData } = await supabase
      .from("courts")
      .select("*")
      .eq("venue_id", venue.id)
      .eq("is_active", true)

    const courts: CourtItem[] = courtsData || []

    // 3. Fetch Pricing Rules
    let pricingRules: PricingRule[] = []
    if (courts.length > 0) {
      const { data: rulesData } = await supabase
        .from("pricing_rules")
        .select("*, courts(name)")
        .in("court_id", courts.map(c => c.id))

      pricingRules = (rulesData || []).map((rule: any) => ({
        id: rule.id,
        court_name: rule.courts.name,
        day_of_week: rule.day_of_week,
        start_time: rule.start_time,
        end_time: rule.end_time,
        price: rule.price,
        promo_price: rule.promo_price,
        is_promo_active: rule.is_promo_active
      }))
    }

    // 4. Fetch Reviews
    const { data: reviewsData } = await supabase
      .from("reviews")
      .select(`
        id, rating, comment, venue_response, created_at,
        profiles (full_name, avatar_url)
      `)
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false })

    const reviews: ReviewItem[] = (reviewsData || []) as any

    return { venue, courts, pricingRules, reviews }
  },
  ['venue-profile'], // Cache tags/keys
  { revalidate: 3600, tags: ['venues'] } // 1 hour cache
)

export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const data = await getVenueData(params.id)
  
  if (!data?.venue) return { title: "Cancha no encontrada | ReservaYa" }
  
  const venue = data.venue
  const title = `${venue.name} | ReservaYa`
  const description = venue.description || `Reservá tu cancha en ${venue.name} de forma fácil y rápida.`
  const ogImage = venue.photos?.[0] || 'https://reservaya.com/default-og.png'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImage],
      type: "website",
      locale: "es_AR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    }
  }
}

export default async function VenuePage({ params }: { params: { id: string } }) {
  const data = await getVenueData(params.id)
  
  if (!data) notFound()
    
  const { venue, courts, pricingRules, reviews } = data

  // Structured Data (JSON-LD) for Local SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    description: venue.description || `Canchas de fútbol en ${venue.city}`,
    image: venue.photos || [],
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: venue.city,
      addressCountry: 'AR'
    },
    geo: (venue.latitude && venue.longitude) ? {
      '@type': 'GeoCoordinates',
      latitude: venue.latitude,
      longitude: venue.longitude
    } : undefined,
    telephone: venue.phone,
    aggregateRating: venue.review_count > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: venue.avg_rating,
      reviewCount: venue.review_count
    } : undefined
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Galería Header */}
      <div>
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">{venue.name}</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-2 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{venue.address}, {venue.city}</span>
            </div>
            {venue.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                <span>{venue.phone}</span>
              </div>
            )}
          </div>
        </div>
        
        <VenueGallery photos={venue.photos || []} venueName={venue.name} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content (Left, 2/3) */}
        <div className="lg:col-span-2 space-y-12">
          {/* About */}
          {venue.description && (
            <section className="space-y-4">
              <h3 className="text-xl font-bold">Sobre el complejo</h3>
              <p className="text-muted-foreground leading-relaxed">{venue.description}</p>
            </section>
          )}

          {/* Amenities */}
          {venue.amenities && venue.amenities.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xl font-bold">Comodidades</h3>
              <div className="flex flex-wrap gap-3">
                {venue.amenities.map((amenity: string) => (
                  <div key={amenity} className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="capitalize">{amenity}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Courts List */}
          <section>
            <CourtList courts={courts} />
          </section>

          {/* Availability Grid */}
          <section>
            <Suspense fallback={
              <div className="flex items-center justify-center p-12 text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Cargando disponibilidad...
              </div>
            }>
              <AvailabilityGrid venueId={venue.id} courts={courts} />
            </Suspense>
          </section>

          {/* Pricing Table */}
          <section>
            <PricingTable pricingRules={pricingRules} />
          </section>
        </div>

        {/* Sidebar (Right, 1/3) */}
        <div className="space-y-8">
          {/* Chat Button */}
          <div className="bg-card border border-border/50 rounded-xl p-4 shadow-xs">
            <h3 className="font-bold text-lg mb-2">¿Tenés dudas?</h3>
            <p className="text-sm text-muted-foreground mb-4">Hablá directamente con el predio y resolvé tus consultas al instante.</p>
            <PlayerChatModal venueId={venue.id} venueName={venue.name} />
          </div>

          {/* Mini Map */}
          {venue.latitude && venue.longitude && (
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border/50 bg-muted/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Ubicación
                </h3>
              </div>
              <div className="h-[250px] w-full">
                <VenueMap 
                  venues={[{
                    id: venue.id,
                    name: venue.name,
                    address: venue.address,
                    city: venue.city,
                    avg_rating: venue.avg_rating,
                    review_count: venue.review_count,
                    featured_image: venue.photos?.[0] || null,
                    latitude: venue.latitude,
                    longitude: venue.longitude,
                    min_price: 0,
                    court_types: []
                  }]} 
                />
              </div>
              <div className="p-4 text-sm text-muted-foreground">
                <p>{venue.address}, {venue.city}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <section className="pt-8 border-t border-border/50">
        <ReviewSection 
          venueId={venue.id} 
          avgRating={venue.avg_rating} 
          reviewCount={venue.review_count} 
          reviews={reviews} 
        />
      </section>
    </div>
  )
}
