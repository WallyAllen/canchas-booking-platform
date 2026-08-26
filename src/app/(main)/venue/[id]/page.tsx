/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VenueGallery } from "@/components/venue/VenueGallery"
import { CourtList, CourtItem } from "@/components/venue/CourtList"
import { AvailabilityGrid } from "@/components/venue/AvailabilityGrid"
import { PricingTable, PricingRule } from "@/components/venue/PricingTable"
import { ReviewSection, ReviewItem } from "@/components/venue/ReviewSection"
import { VenueMap } from "@/components/map/VenueMap"
import { MapPin, Phone, CheckCircle2 } from "lucide-react"

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: venue } = await (supabase.from("venues") as any)
    .select("name, description")
    .eq("id", params.id)
    .single()

  if (!venue) return { title: "Cancha no encontrada | ReservaYa" }

  return {
    title: `${venue.name} | ReservaYa`,
    description: venue.description || `Reservá tu cancha en ${venue.name} de forma fácil y rápida con ReservaYa.`,
  }
}

export default async function VenuePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // 1. Fetch Venue data
  const { data: venue, error: venueError } = await (supabase.from("venues") as any)
    .select("*")
    .eq("id", params.id)
    .eq("is_active", true)
    .single()

  if (venueError || !venue) {
    notFound()
  }

  // 2. Fetch Courts
  const { data: courtsData } = await supabase
    .from("courts")
    .select("*")
    .eq("venue_id", venue.id)
    .eq("is_active", true)

  const courts: CourtItem[] = courtsData || []

  // 3. Fetch Pricing Rules for these courts
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
      id,
      rating,
      comment,
      venue_response,
      created_at,
      profiles (
        full_name,
        avatar_url
      )
    `)
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false })

  const reviews: ReviewItem[] = (reviewsData || []) as any

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-12">
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
            <AvailabilityGrid venueId={venue.id} courts={courts} />
          </section>

          {/* Pricing Table */}
          <section>
            <PricingTable pricingRules={pricingRules} />
          </section>
        </div>

        {/* Sidebar (Right, 1/3) */}
        <div className="space-y-8">
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
